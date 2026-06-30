"use client";

import { useMemo, useState } from "react";
import type {
  DocType,
  ExtractedDocument,
  Report,
  TipoSolicitante,
} from "@/lib/types";
import { requiredDocs, DOC_LABELS } from "@/lib/documents";
import { buildReport } from "@/lib/rules/engine";
import { extractDocuments } from "@/lib/client";
import DocumentUploader from "./DocumentUploader";
import ReportView from "./ReportView";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import { Badge, Button, Card, cn } from "./ui";
import {
  Alert,
  ArrowLeft,
  ArrowRight,
  Building,
  Lock,
  Plus,
  Printer,
  User,
} from "./icons";

type Step = "tipo" | "subida" | "procesando" | "informe";

export default function VerificadorApp() {
  const [step, setStep] = useState<Step>("tipo");
  const [tipo, setTipo] = useState<TipoSolicitante | null>(null);
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [documents, setDocuments] = useState<ExtractedDocument[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const docTypes = useMemo(() => (tipo ? requiredDocs(tipo) : []), [tipo]);
  const faltantes = docTypes.filter((dt) => !files[dt]);
  const completados = docTypes.length - faltantes.length;

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
    <div className="min-h-screen">
      {/* App bar */}
      <header className="no-print sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <Stepper step={step} />

        {error && (
          <Card className="no-print mb-6 flex items-start gap-3 border-danger/30 bg-danger-soft/50 p-4 text-sm text-danger">
            <Alert width={18} height={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </Card>
        )}

        {/* Paso 1: tipo de solicitante */}
        {step === "tipo" && (
          <section>
            <h1 className="text-xl font-bold tracking-tight">Nueva verificación</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige quién solicita la certificación. Esto define qué documentos y reglas aplican.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <TipoCard
                titulo="Persona natural"
                desc="Formulario, avalúo, dominio vigente y cédula (ambos lados)."
                icon={<User width={22} height={22} />}
                onClick={() => elegirTipo("natural")}
              />
              <TipoCard
                titulo="Sociedad jurídica"
                desc="Suma el e-RUT y verifica razón social y representante legal."
                icon={<Building width={22} height={22} />}
                onClick={() => elegirTipo("sociedad")}
              />
            </div>
          </section>
        )}

        {/* Paso 2: subida */}
        {step === "subida" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Sube los documentos</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tipo === "sociedad" ? "Sociedad jurídica" : "Persona natural"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={nuevaComparacion}>
                <ArrowLeft width={15} height={15} />
                Cambiar tipo
              </Button>
            </div>

            {/* Progreso */}
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(completados / docTypes.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular">
                {completados}/{docTypes.length}
              </span>
            </div>

            <DocumentUploader docTypes={docTypes} files={files} onSet={setFile} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {faltantes.length === 0
                  ? "Todos los documentos cargados."
                  : `Faltan ${faltantes.length} documento(s).`}
              </p>
              <Button disabled={faltantes.length > 0} onClick={procesar}>
                Verificar documentos
                <ArrowRight width={16} height={16} />
              </Button>
            </div>
          </section>
        )}

        {/* Paso 3: procesando */}
        {step === "procesando" && (
          <section className="flex flex-col items-center justify-center gap-5 py-24 text-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-border border-t-primary" />
            <div>
              <p className="text-sm font-semibold">Verificando documentos…</p>
              <p className="mt-1 text-xs text-muted-foreground">
                La IA está leyendo cada documento y el motor de reglas los compara.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {docTypes.map((dt) => (
                <span
                  key={dt}
                  className="animate-pulse rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {DOC_LABELS[dt]}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Paso 4: informe */}
        {step === "informe" && report && (
          <section className="space-y-6">
            <div className="no-print flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight">Informe de verificación</h1>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer width={15} height={15} />
                  Exportar PDF
                </Button>
                <Button size="sm" onClick={nuevaComparacion}>
                  <Plus width={15} height={15} />
                  Nueva comparación
                </Button>
              </div>
            </div>

            <ReportView report={report} documents={documents} files={files} />

            <div className="no-print flex items-start gap-2.5 rounded-lg bg-muted p-3.5 text-xs text-muted-foreground">
              <Lock width={15} height={15} className="mt-0.5 shrink-0" />
              <span>
                Los datos viven solo en este navegador. Al apretar “Nueva comparación” se
                borran los archivos y los datos extraídos. Nada se guarda en el servidor.
              </span>
            </div>
          </section>
        )}
      </main>

      <footer className="no-print mx-auto max-w-3xl px-4 pb-8 pt-2">
        <p className="text-center text-[11px] text-muted-foreground">
          Verificador SAG · Procesamiento conforme a la Ley 19.628 de protección de datos
        </p>
      </footer>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "tipo", label: "Tipo" },
    { key: "subida", label: "Documentos" },
    { key: "informe", label: "Informe" },
  ];
  const activeIndex = step === "procesando" ? 1 : steps.findIndex((s) => s.key === step);

  return (
    <ol className="no-print mb-8 flex items-center gap-1.5 text-xs">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={s.key} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={cn("font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1.5 h-px w-6 bg-border" aria-hidden />
            )}
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
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icon}
      </span>
      <p className="mt-3 flex items-center gap-1.5 font-semibold">
        {titulo}
        <ArrowRight
          width={16}
          height={16}
          className="text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </button>
  );
}
