import { NextResponse } from "next/server";
import type { DocType, ExtractResponse } from "@/lib/types";
import { DOC_SPECS } from "@/lib/extraction/schemas";
import { extractDocument, type ExtractInput } from "@/lib/gemini";

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
const VALID_DOCTYPES = new Set(Object.keys(DOC_SPECS));

export async function POST(req: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Petición inválida (se esperaba FormData)." }, { status: 400 });
  }

  const inputs: ExtractInput[] = [];
  for (const [key, value] of form.entries()) {
    if (!(value instanceof File)) continue;
    if (!VALID_DOCTYPES.has(key)) {
      return NextResponse.json({ error: `Documento desconocido: ${key}.` }, { status: 400 });
    }
    if (value.size === 0) continue;
    if (value.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo "${value.name}" supera 15 MB.` },
        { status: 413 },
      );
    }
    const buffer = Buffer.from(await value.arrayBuffer());
    inputs.push({
      docType: key as DocType,
      fileName: value.name,
      mimeType: value.type || "application/octet-stream",
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
