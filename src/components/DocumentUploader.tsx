"use client";

import { useRef, useState } from "react";
import type { DocType } from "@/lib/types";
import { DOC_HELP, DOC_LABELS } from "@/lib/documents";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

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

  function handleFiles(list: FileList | null) {
    const f = list?.[0];
    if (f) onSet(docType, f);
  }

  return (
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
      className={`rounded-xl border p-4 transition ${
        file
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
          : dragging
            ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{DOC_LABELS[docType]}</p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {DOC_HELP[docType]}
          </p>
        </div>
        {file && <span className="text-lg leading-none text-emerald-600">✓</span>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {file ? "Cambiar" : "Subir archivo"}
        </button>
        {file ? (
          <>
            <span className="max-w-[55%] truncate text-xs text-zinc-600 dark:text-zinc-300" title={file.name}>
              {file.name}
            </span>
            <button
              type="button"
              onClick={() => onSet(docType, null)}
              className="ml-auto text-xs text-red-600 hover:underline"
            >
              Quitar
            </button>
          </>
        ) : (
          <span className="text-xs text-zinc-400">o arrastra aquí (PDF/JPG/PNG)</span>
        )}
      </div>
    </div>
  );
}
