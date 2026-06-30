import "server-only";

import type { DocType, ExtractedDocument, ExtractedFields, FieldValue } from "./types";
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

/**
 * Lista de credenciales. Acepta varias separadas por coma en GEMINI_API_KEYS
 * (o GEMINI_API_KEY). Ante un 429 (cuota agotada) se rota a la siguiente.
 */
function getApiKeys(): string[] {
  const raw = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "").trim();
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error(
      "Falta GEMINI_API_KEY. Copia .env.example a .env.local y agrega tu key.",
    );
  }
  return keys;
}

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial con jitter, topado a MAX_DELAY_MS. */
function backoff(attempt: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return exp / 2 + Math.random() * (exp / 2); // jitter
}

/** Parsea Retry-After (segundos) a ms, topado. null si no aplica. */
function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  const secs = Number(h);
  if (!Number.isFinite(secs) || secs < 0) return null;
  return Math.min(secs * 1000, MAX_DELAY_MS);
}

type GeminiResult =
  | { ok: true; res: Response }
  | { ok: false; status: number; detail: string };

/**
 * POST a Gemini con reintentos. Reintenta en 429/503/5xx y errores de red,
 * con backoff exponencial (respetando Retry-After si viene). En 429 rota a la
 * siguiente API key. Errores 4xx no reintentables se devuelven de inmediato.
 */
async function postToGemini(model: string, bodyStr: string): Promise<GeminiResult> {
  const keys = getApiKeys();
  let keyIdx = 0;
  let lastStatus = 0;
  let lastDetail = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { url, headers } = buildRequest(keys[keyIdx % keys.length], model);

    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body: bodyStr });
    } catch (e) {
      // Error de red: reintentable. El mensaje puede traer la URL (con ?key=),
      // así que solo va al log del servidor.
      lastStatus = 0;
      lastDetail = (e as Error).message;
      console.error(`[extract] red, intento ${attempt + 1}/${MAX_ATTEMPTS}:`, lastDetail);
      if (attempt < MAX_ATTEMPTS - 1) await sleep(backoff(attempt));
      continue;
    }

    if (res.ok) return { ok: true, res };

    lastStatus = res.status;
    lastDetail = shorten(await res.text().catch(() => ""));

    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable) return { ok: false, status: res.status, detail: lastDetail };

    console.error(`[extract] Gemini ${res.status}, intento ${attempt + 1}/${MAX_ATTEMPTS}:`, lastDetail);
    if (res.status === 429) keyIdx++; // cuota: prueba la siguiente key
    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(parseRetryAfter(res.headers.get("retry-after")) ?? backoff(attempt));
    }
  }

  return { ok: false, status: lastStatus, detail: lastDetail };
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

  let model: string;
  try {
    model = getModel();
    getApiKeys(); // valida que haya al menos una key antes de armar el body
  } catch (e) {
    return empty((e as Error).message);
  }

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

  const result = await postToGemini(model, JSON.stringify(body));
  if (!result.ok) {
    // El detalle ya se logueó en postToGemini; al cliente solo mensaje genérico.
    if (result.status === 0) return empty("No se pudo contactar la IA. Intenta de nuevo.");
    if (result.status === 429) return empty("La IA está sin cuota disponible. Intenta más tarde.");
    return empty(`La IA no pudo procesar el documento (error ${result.status}).`);
  }

  let json: unknown;
  try {
    json = await result.res.json();
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
    fields[f.key] = spec.locate
      ? parseLocatedField(parsed[f.key])
      : parseFlatField(parsed[f.key]);
  }

  return { docType: input.docType, fileName: input.fileName, fields };
}

/** Documentos normales: el campo es un string plano (o null). */
function parseFlatField(v: unknown): FieldValue {
  const value = typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  return { value, legible: value !== null };
}

/**
 * Documentos con `locate` (avaluo): el campo es {value, box_2d, page}.
 * Valida la caja defensivamente; si está malformada se descarta (no se lanza).
 */
function parseLocatedField(v: unknown): FieldValue {
  if (v === null || typeof v !== "object") return parseFlatField(v);
  const obj = v as Record<string, unknown>;

  const rawValue = obj.value;
  const value =
    typeof rawValue === "string" && rawValue.trim() !== "" ? rawValue.trim() : null;

  const field: FieldValue = { value, legible: value !== null };

  const box = parseBox(obj.box_2d);
  if (box) field.box = box;

  const page = parsePage(obj.page);
  if (page !== undefined) field.page = page;

  return field;
}

/** Acepta solo un array de 4 números finitos dentro de 0..1000. */
function parseBox(raw: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 4) return undefined;
  const nums: number[] = [];
  for (const n of raw) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1000) {
      return undefined;
    }
    nums.push(n);
  }
  return [nums[0], nums[1], nums[2], nums[3]];
}

/** Página 1-based como entero positivo, o undefined. */
function parsePage(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined;
  const p = Math.round(raw);
  return p >= 1 ? p : undefined;
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
