import { NextResponse } from "next/server";
import type { DocType, ExtractResponse } from "@/lib/types";
import { DOC_SPECS } from "@/lib/extraction/schemas";
import { extractDocument, type ExtractInput } from "@/lib/gemini";
import { prepareImage } from "@/lib/extraction/downscale";
import { getClientIp, rateLimitOk, sameOriginOk } from "@/lib/security";

// ───────────────────────────────────────────────────────────────
// POST /api/extract
// Recibe los archivos (FormData, una entrada por docType), llama a la
// IA para extraer los campos y devuelve el JSON. Aquí vive la API key
// (servidor). NADA se guarda en disco ni en base de datos: los buffers
// existen solo durante la petición.
// ───────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB por archivo (límite inline de Gemini)
const MAX_FILES = Object.keys(DOC_SPECS).length; // un archivo por docType, no más
const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // tope agregado de toda la petición
const VALID_DOCTYPES = new Set(Object.keys(DOC_SPECS));

export async function POST(req: Request): Promise<NextResponse> {
  // Guardas de abuso: cross-origin de navegador + rate-limit por IP (best-effort).
  if (!sameOriginOk(req)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (!rateLimitOk(getClientIp(req))) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento." },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición inválida (se esperaba FormData)." }, { status: 400 });
  }

  const inputs: ExtractInput[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;
  for (const [key, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    if (!VALID_DOCTYPES.has(key)) {
      return NextResponse.json({ error: `Documento desconocido: ${key}.` }, { status: 400 });
    }
    // Un solo archivo por docType: rechaza claves repetidas (anti-amplificación).
    if (seen.has(key)) {
      return NextResponse.json({ error: `Documento duplicado: ${key}.` }, { status: 400 });
    }
    if (value.size === 0) continue;
    if (value.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo "${value.name}" supera 15 MB.` },
        { status: 413 },
      );
    }
    seen.add(key);
    if (seen.size > MAX_FILES) {
      return NextResponse.json({ error: "Demasiados archivos." }, { status: 400 });
    }
    totalBytes += value.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "La petición supera el tamaño máximo." }, { status: 413 });
    }
    const rawBuffer = Buffer.from(await value.arrayBuffer());
    // Baja la resolución de las imágenes para gastar menos tokens de Gemini.
    // Los PDF y formatos no-imagen pasan intactos; ante cualquier error
    // prepareImage devuelve el original (no rompe la extracción).
    const { buffer, mimeType } = await prepareImage(
      rawBuffer,
      value.type || "application/octet-stream",
    );
    inputs.push({
      docType: key as DocType,
      fileName: value.name,
      mimeType,
      base64: buffer.toString("base64"),
    });
  }

  if (inputs.length === 0) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  // Extracción en paralelo. extractDocument no lanza: captura su propio error.
  const documents = await Promise.all(inputs.map(extractDocument));

  const payload: ExtractResponse = { documents };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
