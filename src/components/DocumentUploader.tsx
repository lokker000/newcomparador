"use client";

import { useRef, useState } from "react";
import type { DocType } from "@/lib/types";
import { DOC_HELP, DOC_LABELS } from "@/lib/documents";
import { cn } from "./ui";
import { Check, FileDoc, Upload, X } from "./icons";
import PdfCropper from "./PdfCropper";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

/** DocTypes that require the PDF crop flow. */
const CEDULA_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  "cedula_frente",
  "cedula_reverso",
]);

interface Props {
  docTypes: DocType[];
  files: Partial<Record<DocType, File>>;
  onSet: (docType: DocType, file: File | null) => void;
}

export default function DocumentUploader({ docTypes, files, onSet }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {docTypes.map((dt) => (
        <Slot key={dt} docType={dt} file={files[dt]} onSet={onSet} />
      ))}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Slot({
  docType,
  file,
  onSet,
}: {
  docType: DocType;
  file?: File;
  onSet: (docType: DocType, file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /** PDF file pending crop (only for cédula docTypes). */
  const [pendingCrop, setPendingCrop] = useState<File | null>(null);

  /** Returns true if this slot + file combination requires crop. */
  function needsCrop(f: File): boolean {
    return CEDULA_TYPES.has(docType) && f.type === "application/pdf";
  }

  function handleFiles(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (needsCrop(f)) {
      setPendingCrop(f);
    } else {
      onSet(docType, f);
    }
  }

  function handleCropConfirm(croppedFile: File) {
    onSet(docType, croppedFile);
    setPendingCrop(null);
  }

  function handleCropCancel() {
    setPendingCrop(null);
    // Reset the input so the same file can be re-selected.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      {pendingCrop && (
        <PdfCropper
          file={pendingCrop}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative rounded-xl border bg-card p-4 transition-colors",
          file
            ? "border-primary/40"
            : dragging
              ? "border-primary border-dashed bg-primary-soft/40"
              : "border-border hover:border-border-strong",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              file ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {file ? <Check width={18} height={18} /> : <FileDoc width={18} height={18} />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{DOC_LABELS[docType]}</p>
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {DOC_HELP[docType]}
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          {file ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-xs font-medium" title={file.name}>
                  {file.name}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular">
                  {formatSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cambiar
              </button>
              <button
                type="button"
                aria-label="Quitar archivo"
                onClick={() => onSet(docType, null)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <X width={15} height={15} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border-strong py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Upload width={15} height={15} />
              Subir o arrastrar archivo
            </button>
          )}
        </div>
      </div>
    </>
  );
}
