"use client";

import { useMemo, useState } from "react";
import type {
  DocType,
  ExtractedDocument,
  Report,
  TipoSolicitante,
} from "@/lib/types";
import { requiredDocs } from "@/lib/documents";
import { buildReport } from "@/lib/rules/engine";
import { extractDocuments } from "@/lib/client";
import DocumentUploader from "./DocumentUploader";
import ReportView from "./ReportView";
import ThemeToggle from "./ThemeToggle";

type Step = "tipo" | "subida" | "procesando" | "informe";

export default function VerificadorApp() {
  const [step, setStep] = useState<Step>("tipo");
  const [tipo, setTipo] = useState<TipoSolicitante | null>(null);
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docTypes = useMemo(
    () => (tipo ? requiredDocs(tipo) : []),
    [tipo],
  );
  const faltantes = docTypes.filter((dt) => !files[dt]);

  function elegirTipo(t: TipoSolicitante) {
    setTipo(t);
    setStep("subida");
  }

  function setFile(docType: DocType, file: File | null) {
    setFiles((prev) => {
      const next = { ...prev };
      if (file) next[docType] = file;
      else delete next[docType];
      return next;
    });
  }

  async function procesar() {
    if (!tipo || faltantes.length > 0) return;
    setError(null);
    setStep("procesando");
    try {
      const docs = await extractDocuments(files);
      setDocuments(docs);
      setReport(buildReport(docs, tipo));
      setStep("informe");
    } catch (e) {
      setError((e as Error).message);
      setStep("subida");
    }
  }

  // "Nueva comparación": borra TODO del navegador y vuelve al inicio.
  function nuevaComparacion() {
    setFiles({});
    setDocuments([]);
    setReport(null);
    setError(null);
    setTipo(null);
    setStep("tipo");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Verificador SAG</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Certificación de subdivisión de predios rústicos. Compara el formulario
            contra los documentos de respaldo.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Stepper step={step} />

      {error && (
        <div className="no-print mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Paso 1: tipo de solicitante */}
      {step === "tipo" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">¿Quién solicita?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <TipoCard
              titulo="Persona natural"
              desc="El solicitante es una persona. Se piden formulario, avalúo, CBR y cédula (ambos lados)."
              icon="👤"
              onClick={() => elegirTipo("natural")}
            />
            <TipoCard
              titulo="Sociedad jurídica"
              desc="El solicitante es una empresa. Suma el e-RUT y verifica razón social y representante legal."
              icon="🏢"
              onClick={() => elegirTipo("sociedad")}
            />
          </div>
        </section>
      )}

      {/* Paso 2: subida */}
      {step === "subida" && (
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sube los documentos</h2>
            <button
              type="button"
              onClick={nuevaComparacion}
              className="text-sm text-zinc-500 hover:underline"
            >
              ← Cambiar tipo
            </button>
          </div>

          <DocumentUploader docTypes={docTypes} files={files} onSet={setFile} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">
              {faltantes.length === 0
                ? "Todos los documentos cargados."
                : `Faltan ${faltantes.length} documento(s).`}
            </p>
            <button
              type="button"
              disabled={faltantes.length > 0}
              onClick={procesar}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Verificar documentos
            </button>
          </div>
        </section>
      )}

      {/* Paso 3: procesando */}
      {step === "procesando" && (
        <section className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600" />
          <p className="text-sm text-zinc-500">
            Leyendo los documentos con la IA y comparando…
          </p>
        </section>
      )}

      {/* Paso 4: informe */}
      {step === "informe" && report && (
        <section className="space-y-6">
          <div className="no-print flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              🖨️ Exportar / Imprimir PDF
            </button>
            <button
              type="button"
              onClick={nuevaComparacion}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              ＋ Nueva comparación
            </button>
          </div>

          <ReportView report={report} documents={documents} />

          <p className="no-print rounded-lg bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            🔒 Los datos viven solo en este navegador. Al apretar “Nueva comparación”
            se borran los archivos y los datos extraídos. Nada se guarda en el servidor.
          </p>
        </section>
      )}
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "tipo", label: "Tipo" },
    { key: "subida", label: "Documentos" },
    { key: "informe", label: "Informe" },
  ];
  const activeIndex =
    step === "procesando" ? 1 : steps.findIndex((s) => s.key === step);

  return (
    <ol className="no-print mb-6 flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-semibold ${
                active
                  ? "bg-blue-600 text-white"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-semibold" : "text-zinc-500"}>{s.label}</span>
            {i < steps.length - 1 && <span className="text-zinc-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function TipoCard({
  titulo,
  desc,
  icon,
  onClick,
}: {
  titulo: string;
  desc: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-zinc-200 bg-white p-5 text-left transition hover:border-blue-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-600"
    >
      <span className="text-3xl">{icon}</span>
      <p className="mt-2 font-semibold">{titulo}</p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
    </button>
  );
}
