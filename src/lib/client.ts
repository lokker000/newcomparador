import type { DocType, ExtractResponse, ExtractedDocument } from "./types";

// ───────────────────────────────────────────────────────────────
// Helpers del lado del navegador. Llama al endpoint de extracción.
// Los archivos se mandan como FormData; nunca se guardan en el cliente
// más allá del estado de React en memoria.
// ───────────────────────────────────────────────────────────────

export async function extractDocuments(
  files: Partial<Record<DocType, File>>,
): Promise<ExtractedDocument[]> {
  const form = new FormData();
  for (const [docType, file] of Object.entries(files)) {
    if (file) form.append(docType, file);
  }

  const res = await fetch("/api/extract", { method: "POST", body: form });

  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as ExtractResponse;
  return data.documents;
}
