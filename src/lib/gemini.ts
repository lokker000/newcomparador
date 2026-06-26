import "server-only";

import type { DocType, ExtractedDocument, ExtractedFields } from "./types";
import { DOC_SPECS, buildPrompt, buildResponseSchema } from "./extraction/schemas";

// ───────────────────────────────────────────────────────────────
// Adaptador de la IA (Google Gemini). VIVE SOLO EN EL SERVIDOR.
// La API key nunca llega al navegador. Si mañana cambiamos de
// proveedor, solo se reescribe este archivo: la firma extractDocument
// es el contrato que usa el resto del sistema.
// ───────────────────────────────────────────────────────────────

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION =
  "Eres un sistema de extracción de datos de documentos oficiales chilenos. " +
  "Devuelves únicamente JSON válido con los campos solicitados. " +
  "Si un dato no es legible o no existe, devuelves null. Nunca inventas.";

/** Tipos MIME aceptados por Gemini para inline_data. */
const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface ExtractInput {
  docType: DocType;
  fileName: string;
  mimeType: string;
  /** Contenido del archivo en base64 (sin el prefijo data:). */
  base64: string;
}

export function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta GEMINI_API_KEY. Copia .env.example a .env.local y agrega tu key.",
    );
  }
  return key;
}

/**
 * Por defecto la credencial es una API key y va como ?key=... (esto cubre
 * tanto las keys clásicas "AIza..." como las nuevas "AQ..."). Si en cambio
 * se usa un access token OAuth, hay que poner GEMINI_AUTH=bearer en el entorno.
 */
function buildRequest(key: string, model: string): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.GEMINI_AUTH?.trim().toLowerCase() === "bearer") {
    headers["Authorization"] = `Bearer ${key}`;
    return { url: `${ENDPOINT}/${model}:generateContent`, headers };
  }
  return {
    url: `${ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(key)}`,
    headers,
  };
}

/** Extrae los campos de UN documento. No lanza: devuelve el error en el objeto. */
export async function extractDocument(input: ExtractInput): Promise<ExtractedDocument> {
  const spec = DOC_SPECS[input.docType];

  const empty = (error: string): ExtractedDocument => ({
    docType: input.docType,
    fileName: input.fileName,
    fields: emptyFields(input.docType),
    error,
  });

  const mime = normalizeMime(input.mimeType);
  if (!SUPPORTED_MIME.has(mime)) {
    return empty(`Formato no soportado: ${input.mimeType}. Usa PDF, JPG, PNG o WEBP.`);
  }

  let key: string;
  let model: string;
  try {
    key = getApiKey();
    model = getModel();
  } catch (e) {
    return empty((e as Error).message);
  }

  const { url, headers } = buildRequest(key, model);

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(input.docType) },
          { inline_data: { mime_type: mime, data: input.base64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: buildResponseSchema(input.docType),
    },
  };

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    return empty(`No se pudo contactar la IA: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return empty(`La IA respondió ${res.status}: ${shorten(text)}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return empty("La IA devolvió una respuesta no-JSON.");
  }

  const raw = extractText(json);
  if (!raw) {
    return empty("La IA no devolvió contenido (posible bloqueo o cuota agotada).");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty("No se pudo interpretar el JSON de la IA.");
  }

  const fields: ExtractedFields = {};
  for (const f of spec.fields) {
    const v = parsed[f.key];
    const value = typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    fields[f.key] = { value, legible: value !== null };
  }

  return { docType: input.docType, fileName: input.fileName, fields };
}

function emptyFields(docType: DocType): ExtractedFields {
  const out: ExtractedFields = {};
  for (const f of DOC_SPECS[docType].fields) {
    out[f.key] = { value: null, legible: false };
  }
  return out;
}

function normalizeMime(mime: string): string {
  const m = mime.toLowerCase().split(";")[0].trim();
  return m === "image/jpg" ? "image/jpeg" : m;
}

/** Saca el texto de la respuesta de Gemini sin asumir tipos. */
function extractText(json: unknown): string | null {
  const candidates = (json as { candidates?: unknown[] })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const texts = parts
    .map((p) => (p as { text?: string })?.text)
    .filter((t): t is string => typeof t === "string");
  return texts.length ? texts.join("") : null;
}

function shorten(s: string, max = 300): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}
