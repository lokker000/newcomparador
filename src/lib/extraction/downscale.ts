import "server-only";

import sharp from "sharp";

// ───────────────────────────────────────────────────────────────
// Pre-procesamiento de imágenes ANTES de mandarlas a Gemini.
//
// Gemini cuenta los tokens de una imagen por sus DIMENSIONES en píxeles
// (la trocea en "tiles" de 768px), no por el peso del archivo. Por eso
// la única palanca que reduce tokens de entrada es bajar la resolución;
// la calidad JPEG solo ayuda a no pasarnos del límite de 15 MB y a subir
// más rápido, pero NO cambia el conteo de tokens.
//
// Solo tocamos imágenes rasterizadas. Los PDF se cobran por página a una
// resolución fija que no controlamos desde aquí, así que pasan intactos.
//
// Regla de oro: esto NUNCA debe romper la extracción. Ante cualquier
// error (formato raro, sharp falla), devolvemos el buffer original.
// ───────────────────────────────────────────────────────────────

/** Lado mayor máximo, en píxeles. 1536 = 2×768 (borde limpio de tile). */
const DEFAULT_MAX_PX = 1536;
/** Calidad JPEG de salida (afecta peso/subida, no tokens). */
const DEFAULT_JPEG_QUALITY = 82;

/** MIME de imágenes rasterizadas que sharp puede redimensionar. */
const RASTER_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function maxPx(): number {
  const v = Number(process.env.EXTRACT_MAX_IMAGE_PX);
  return Number.isFinite(v) && v >= 256 ? Math.floor(v) : DEFAULT_MAX_PX;
}

function jpegQuality(): number {
  const v = Number(process.env.EXTRACT_JPEG_QUALITY);
  return Number.isFinite(v) && v >= 1 && v <= 100 ? Math.floor(v) : DEFAULT_JPEG_QUALITY;
}

export interface PreparedImage {
  buffer: Buffer;
  mimeType: string;
  /** true si efectivamente redimensionamos/recodificamos. */
  changed: boolean;
}

/**
 * Reduce la resolución de una imagen para que su lado mayor no supere
 * EXTRACT_MAX_IMAGE_PX, normaliza la orientación EXIF y la recodifica a
 * JPEG. No agranda imágenes pequeñas. Devuelve el original si no es una
 * imagen rasterizada o si algo falla.
 */
export async function prepareImage(buffer: Buffer, mimeType: string): Promise<PreparedImage> {
  const mime = mimeType.toLowerCase().split(";")[0].trim();
  if (!RASTER_MIME.has(mime)) {
    return { buffer, mimeType, changed: false };
  }

  const limit = maxPx();

  try {
    // limitInputPixels frena "decompression bombs" (archivo chico → millones de
    // píxeles al decodificar) antes de gastar memoria. 50 MP cubre fotos reales.
    const img = sharp(buffer, { failOn: "none", limitInputPixels: 50_000_000 }).rotate(); // rotate() aplica orientación EXIF
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    // Si ya cabe y ya es JPEG, no ganamos tokens recodificando: lo dejamos tal cual
    // para preservar nitidez del texto.
    const fitsLimit = w > 0 && h > 0 && Math.max(w, h) <= limit;
    if (fitsLimit && (mime === "image/jpeg" || mime === "image/jpg")) {
      return { buffer, mimeType: "image/jpeg", changed: false };
    }

    let pipeline = img;
    if (!fitsLimit) {
      // withoutEnlargement evita agrandar; fit "inside" mantiene proporción.
      pipeline = pipeline.resize({ width: limit, height: limit, fit: "inside", withoutEnlargement: true });
    }

    const out = await pipeline.jpeg({ quality: jpegQuality() }).toBuffer();
    return { buffer: out, mimeType: "image/jpeg", changed: true };
  } catch {
    // Fail-open: cualquier problema y mandamos el original sin tocar.
    return { buffer, mimeType, changed: false };
  }
}
