"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cn } from "./ui";
import { X, Target } from "./icons";
// pdfjs se carga perezoso y client-only (ver src/lib/pdfjs.ts): un import
// estático al tope reventaría el SSR ("DOMMatrix is not defined").
import { getPdfjs } from "@/lib/pdfjs";

export interface EvidenceViewerProps {
  file: File;
  /** [ymin, xmin, ymax, xmax] normalizado a 0..1000. Best-effort de Gemini. */
  box?: [number, number, number, number];
  /** Página 1-based (PDF). Imágenes: ignorada. */
  page?: number;
  fieldLabel: string;
  onClose: () => void;
}

/** Ancho/alto máximo del lienzo dentro del modal (px). */
const MAX_DISPLAY_WIDTH = 720;
const MAX_DISPLAY_HEIGHT = 520;

/** Rectángulo en píxeles del lienzo renderizado. */
interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function EvidenceViewer({
  file,
  box,
  page,
  fieldLabel,
  onClose,
}: EvidenceViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Tamaño renderizado del lienzo (px). El overlay se posiciona en base a esto.
  const [rendered, setRendered] = useState<{ width: number; height: number } | null>(null);

  const isPdf =
    file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  // ── Render del documento (PDF → canvas, imagen → canvas) ─────────
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function fitScale(w: number, h: number): Promise<number> {
      const scaleW = MAX_DISPLAY_WIDTH / w;
      const scaleH = MAX_DISPLAY_HEIGHT / h;
      return Math.min(scaleW, scaleH, 1); // nunca ampliar
    }

    async function renderPdf() {
      const pdfjsLib = await getPdfjs();
      objectUrl = URL.createObjectURL(file);
      const doc = await pdfjsLib.getDocument({ url: objectUrl }).promise;
      const pageNum = Math.min(Math.max(page ?? 1, 1), doc.numPages);
      const pageProxy = await doc.getPage(pageNum);

      const nativeVp = pageProxy.getViewport({ scale: 1 });
      const scale = await fitScale(nativeVp.width, nativeVp.height);
      const viewport = pageProxy.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await pageProxy.render({ canvasContext: ctx, canvas, viewport }).promise;
      if (cancelled) return;
      setRendered({ width: viewport.width, height: viewport.height });
    }

    async function renderImage() {
      objectUrl = URL.createObjectURL(file);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("img load"));
        img.src = objectUrl as string;
      });
      if (cancelled) return;

      const scale = await fitScale(img.naturalWidth, img.naturalHeight);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setRendered({ width: w, height: h });
    }

    async function run() {
      setLoading(true);
      setLoadError(null);
      try {
        if (isPdf) await renderPdf();
        else await renderImage();
      } catch {
        if (!cancelled) {
          setLoadError("No se pudo mostrar el documento original.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, page, isPdf]);

  // ── Escape cierra ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Foco al montar ───────────────────────────────────────────────
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // ── box_2d (0..1000) → píxeles del lienzo renderizado ────────────
  // box = [ymin, xmin, ymax, xmax]
  //   x = xmin/1000 * width,  y = ymin/1000 * height
  //   w = (xmax-xmin)/1000 * width,  h = (ymax-ymin)/1000 * height
  let highlight: PixelRect | null = null;
  if (box && rendered) {
    const [ymin, xmin, ymax, xmax] = box;
    highlight = {
      x: (xmin / 1000) * rendered.width,
      y: (ymin / 1000) * rendered.height,
      w: ((xmax - xmin) / 1000) * rendered.width,
      h: ((ymax - ymin) / 1000) * rendered.height,
    };
  }

  return (
    /* Backdrop */
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal
        aria-label={`Origen del campo ${fieldLabel}`}
        tabIndex={-1}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Target width={18} height={18} className="text-primary" />
            <div>
              <p className="text-sm font-semibold">Origen del dato</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Campo: <span className="font-mono">{fieldLabel}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar visor de origen"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Área del documento */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/50 p-4">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-xs text-muted-foreground">Cargando documento…</p>
            </div>
          )}

          {loadError ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-danger">{loadError}</p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="relative inline-block select-none">
              <canvas
                ref={canvasRef}
                className={cn(
                  "block rounded shadow-sm",
                  loading ? "opacity-0" : "opacity-100",
                )}
              />
              {/* Resaltado de la región de origen */}
              {highlight && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/20"
                  style={{
                    left: highlight.x,
                    top: highlight.y,
                    width: highlight.w,
                    height: highlight.h,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer / nota */}
        <div className="border-t border-border px-5 py-3">
          {box ? (
            <p className="text-xs text-muted-foreground">
              El recuadro marca, de forma aproximada, dónde la IA encontró este
              dato. La ubicación es una estimación y puede no ser exacta.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ubicación aproximada no disponible. Se muestra el documento
              original para revisión manual.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
