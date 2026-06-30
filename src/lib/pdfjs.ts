// pdfjs usa APIs del DOM (DOMMatrix) que NO existen en el server. Importarlo al
// tope de un módulo hace que Next lo evalúe en SSR y reviente. Por eso se carga
// perezoso y SOLO en el navegador (dentro de un efecto/handler, client-only).
// El worker se configura una sola vez al resolver el import.
//
// Este helper es compartido por PdfCropper y EvidenceViewer. NUNCA lo importes
// de forma estática `import * as pdfjs` en el tope: usa siempre `await getPdfjs()`.

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return lib;
    });
  }
  return pdfjsPromise;
}
