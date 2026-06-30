"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { Button, cn } from "./ui";
import { X, Crop, ChevronLeft, ChevronRight } from "./icons";
// pdfjs se carga perezoso y client-only (ver src/lib/pdfjs.ts): un import
// estático al tope reventaría el SSR ("DOMMatrix is not defined").
import { getPdfjs } from "@/lib/pdfjs";

// ── Types ────────────────────────────────────────────────────────

interface SelectionRect {
  /** All values in display-canvas pixel space. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfCropperProps {
  file: File;
  onConfirm: (img: File) => void;
  onCancel: () => void;
}

// ── Constants ────────────────────────────────────────────────────

/** Maximum display width of the canvas inside the modal (px). */
const MAX_DISPLAY_WIDTH = 720;
/** Maximum display height of the canvas inside the modal (px). */
const MAX_DISPLAY_HEIGHT = 520;

// ── Component ────────────────────────────────────────────────────

export default function PdfCropper({ file, onConfirm, onCancel }: PdfCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // The viewport scale used when rendering to the display canvas.
  // We store it so we can invert it when cropping at native resolution.
  const displayScaleRef = useRef<number>(1);
  // Native (un-scaled) viewport dimensions of the current page.
  const nativeViewportRef = useRef<{ width: number; height: number }>({ width: 1, height: 1 });
  // The page proxy cached so the confirm handler can re-render at native res.
  const pageProxyRef = useRef<PDFPageProxy | null>(null);

  // Selection state (pointer drag).
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Load PDF from File ──────────────────────────────────────────

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const pdfjsLib = await getPdfjs();
        objectUrl = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument({ url: objectUrl });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar el PDF. Verifica que el archivo no esté dañado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // ── Render page to display canvas ──────────────────────────────

  const renderPage = useCallback(async (doc: PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current) return;
    setLoading(true);
    setSelection(null);
    try {
      const page = await doc.getPage(pageNum);
      pageProxyRef.current = page;

      // Compute display scale to fit within max dimensions.
      const nativeVp = page.getViewport({ scale: 1 });
      nativeViewportRef.current = { width: nativeVp.width, height: nativeVp.height };

      const scaleW = MAX_DISPLAY_WIDTH / nativeVp.width;
      const scaleH = MAX_DISPLAY_HEIGHT / nativeVp.height;
      const scale = Math.min(scaleW, scaleH, 1); // never upscale
      displayScaleRef.current = scale;

      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Also size the overlay canvas to match.
      if (overlayRef.current) {
        overlayRef.current.width = viewport.width;
        overlayRef.current.height = viewport.height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    } catch {
      setLoadError("No se pudo renderizar esta página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) void renderPage(pdfDoc, currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  // ── Draw overlay (selection rectangle) ─────────────────────────

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!selection) return;

    const { x, y, w, h } = selection;
    if (Math.abs(w) < 2 || Math.abs(h) < 2) return;

    // Dim everything outside the selection.
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, overlay.width, overlay.height);
    ctx.clearRect(x, y, w, h);

    // Selection border.
    ctx.strokeStyle = "oklch(0.66 0.12 158)"; // matches --primary (dark tone)
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, w, h);

    // Corner handles.
    const corners = [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
    ] as const;
    ctx.fillStyle = "#fff";
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [selection]);

  // ── Pointer event helpers ───────────────────────────────────────

  function canvasCoords(
    e: React.PointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = canvasCoords(e);
    dragStart.current = { x, y };
    setSelection({ x, y, w: 0, h: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragStart.current) return;
    const { x, y } = canvasCoords(e);
    setSelection({
      x: dragStart.current.x,
      y: dragStart.current.y,
      w: x - dragStart.current.x,
      h: y - dragStart.current.y,
    });
  }

  function handlePointerUp() {
    dragStart.current = null;
  }

  // ── Normalise rect (handle negative w/h from dragging any direction) ──

  function normalise(r: SelectionRect): SelectionRect {
    return {
      x: r.w >= 0 ? r.x : r.x + r.w,
      y: r.h >= 0 ? r.y : r.y + r.h,
      w: Math.abs(r.w),
      h: Math.abs(r.h),
    };
  }

  const hasSelection =
    selection !== null &&
    Math.abs(selection.w) > 4 &&
    Math.abs(selection.h) > 4;

  // ── Escape key cancels ──────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // ── Focus modal on mount ────────────────────────────────────────

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // ── Confirm: crop at native PDF resolution ─────────────────────

  async function handleConfirm() {
    if (!selection || !pageProxyRef.current) return;
    const norm = normalise(selection);
    setIsConfirming(true);

    try {
      const page = pageProxyRef.current;
      const displayScale = displayScaleRef.current;
      const native = nativeViewportRef.current;

      // Map display-pixel rect → native PDF units.
      // displayScale = displayWidth / nativeWidth, so nativeCoord = displayCoord / displayScale.
      const nativeX = norm.x / displayScale;
      const nativeY = norm.y / displayScale;
      const nativeW = norm.w / displayScale;
      const nativeH = norm.h / displayScale;

      // Clamp to native page bounds.
      const clampedX = Math.max(0, nativeX);
      const clampedY = Math.max(0, nativeY);
      const clampedW = Math.min(nativeW, native.width - clampedX);
      const clampedH = Math.min(nativeH, native.height - clampedY);

      if (clampedW < 1 || clampedH < 1) return;

      // Re-render the page at native resolution (scale = 1) into an offscreen canvas.
      const nativeVp = page.getViewport({ scale: 1 });
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = nativeVp.width;
      fullCanvas.height = nativeVp.height;
      const fullCtx = fullCanvas.getContext("2d");
      if (!fullCtx) return;

      await page.render({ canvasContext: fullCtx, canvas: fullCanvas, viewport: nativeVp }).promise;

      // Extract the selected region into a cropped offscreen canvas.
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.round(clampedW);
      cropCanvas.height = Math.round(clampedH);
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) return;

      cropCtx.drawImage(
        fullCanvas,
        Math.round(clampedX),
        Math.round(clampedY),
        Math.round(clampedW),
        Math.round(clampedH),
        0,
        0,
        Math.round(clampedW),
        Math.round(clampedH),
      );

      // Convert to PNG blob → File.
      const blob = await new Promise<Blob | null>((resolve) => {
        cropCanvas.toBlob(resolve, "image/png");
      });

      if (!blob) return;

      const ext = file.name.replace(/\.pdf$/i, "");
      const croppedFile = new File([blob], `${ext}-recorte.png`, { type: "image/png" });
      onConfirm(croppedFile);
    } finally {
      setIsConfirming(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal
        aria-label="Recorta la cédula"
        tabIndex={-1}
        className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Crop width={18} height={18} className="text-primary" />
            <div>
              <p className="text-sm font-semibold">Recorta la cédula</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Selecciona solo la zona de la cédula que quieres analizar.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar recortador"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X width={16} height={16} />
          </button>
        </div>

        {/* Canvas area */}
        <div className="relative flex flex-1 items-center justify-center overflow-auto bg-muted/50 p-4">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
              <p className="text-xs text-muted-foreground">Cargando PDF…</p>
            </div>
          )}

          {loadError && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-danger">{loadError}</p>
              <Button variant="outline" size="sm" onClick={onCancel}>
                Cancelar
              </Button>
            </div>
          )}

          {!loadError && (
            <div className="relative inline-block select-none">
              {/* PDF render canvas */}
              <canvas
                ref={canvasRef}
                className={cn(
                  "block rounded shadow-sm",
                  loading ? "opacity-0" : "opacity-100",
                )}
              />
              {/* Overlay (selection drawing) */}
              <canvas
                ref={overlayRef}
                className="absolute inset-0 cursor-crosshair rounded"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          {/* Page navigation */}
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft width={16} height={16} />
              </button>
              <span className="text-xs text-muted-foreground tabular">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight width={16} height={16} />
              </button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              {!loading && !loadError && totalPages > 0
                ? "Arrastra para seleccionar la zona."
                : ""}
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!hasSelection || isConfirming || loading}
              onClick={() => void handleConfirm()}
            >
              {isConfirming ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                  Procesando…
                </>
              ) : (
                <>
                  <Crop width={14} height={14} />
                  Recortar y usar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
