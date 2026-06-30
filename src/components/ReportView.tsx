"use client";

import { useState, type ReactNode } from "react";
import type { DocType, ExtractedDocument, Report, RuleResult, RuleStatus, SourceValue } from "@/lib/types";
import { DOC_LABELS } from "@/lib/documents";
import { DOC_SPECS } from "@/lib/extraction/schemas";
import { Badge, Card, cn } from "./ui";
import { Alert, Ban, Check, ChevronDown, Help, ShieldCheck, Target, X } from "./icons";
import EvidenceViewer from "./EvidenceViewer";

type Tone = "ok" | "warn" | "danger" | "neutral";

const STATUS_META: Record<
  RuleStatus,
  { icon: ReactNode; label: string; tone: Tone }
> = {
  ok: { icon: <Check width={13} height={13} />, label: "Coincide", tone: "ok" },
  mismatch: { icon: <X width={13} height={13} />, label: "No coincide", tone: "danger" },
  warn: { icon: <Alert width={13} height={13} />, label: "Difiere", tone: "warn" },
  expired: { icon: <Ban width={13} height={13} />, label: "Vencido", tone: "danger" },
  missing: { icon: <Help width={13} height={13} />, label: "Falta / no legible", tone: "neutral" },
};

/** Origen abierto en el visor de evidencia (solo avaluo). */
interface EvidenceState {
  file: File;
  fieldLabel: string;
  box?: [number, number, number, number];
  page?: number;
}

export default function ReportView({
  report,
  documents,
  files,
}: {
  report: Report;
  documents: ExtractedDocument[];
  files: Partial<Record<DocType, File>>;
}) {
  const conforme = report.veredicto === "conforme";
  const [evidence, setEvidence] = useState<EvidenceState | null>(null);
  const fecha = new Date(report.generatedAt).toLocaleString("es-CL");

  const counts = report.results.reduce(
    (acc, r) => {
      if (r.status === "ok") acc.ok++;
      else acc.obs++;
      return acc;
    },
    { ok: 0, obs: 0 },
  );

  return (
    <div className="print-area space-y-6">
      {/* Veredicto general */}
      <Card
        className={cn(
          "overflow-hidden border-l-4 p-5",
          conforme ? "border-l-ok" : "border-l-warn",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                conforme ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn",
              )}
            >
              {conforme ? <ShieldCheck width={24} height={24} /> : <Alert width={24} height={24} />}
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {conforme ? "Todo conforme" : "Hay observaciones"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {report.tipo === "sociedad" ? "Sociedad jurídica" : "Persona natural"}
                {" · "}
                <span className="tabular">{fecha}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge tone="ok">{counts.ok} conformes</Badge>
            {counts.obs > 0 && <Badge tone="warn">{counts.obs} observaciones</Badge>}
          </div>
        </div>
      </Card>

      {/* Resultados regla por regla */}
      <section>
        <SectionLabel>Verificación campo por campo</SectionLabel>
        <div className="space-y-2.5">
          {report.results.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 font-mono text-xs text-muted-foreground tabular">
                      {String(r.id).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{r.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.detail}</p>
                    </div>
                  </div>
                  <Badge tone={meta.tone}>
                    {meta.icon}
                    {meta.label}
                  </Badge>
                </div>

                {/* Sources renderer — rule 10 (deslindes) uses a full-text
                    stacked layout; all other rules use the compact truncated
                    2-column layout. See RuleSources / DeslindesSourceList. */}
                <RuleSources r={r} />
              </Card>
            );
          })}
        </div>
      </section>

      {/* Datos extraídos por documento */}
      <section>
        <SectionLabel>Datos extraídos por documento</SectionLabel>
        <div className="space-y-2.5">
          {documents.map((doc) => {
            // Solo el avaluo muestra el botón "ver origen", y solo si su archivo
            // original sigue en memoria. El resto de documentos no cambia.
            const avaluoFile =
              doc.docType === "avaluo" ? files.avaluo : undefined;
            return (
              <Card key={doc.docType} className="overflow-hidden">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      {DOC_LABELS[doc.docType]}
                      {doc.error && (
                        <span className="text-xs font-normal text-danger">· {doc.error}</span>
                      )}
                    </span>
                    <ChevronDown
                      width={16}
                      height={16}
                      className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <dl className="grid gap-x-6 gap-y-1.5 border-t border-border p-4 text-xs sm:grid-cols-2">
                    {DOC_SPECS[doc.docType].fields.map((f) => {
                      const fv = doc.fields[f.key];
                      const canLocate = !!avaluoFile && !!fv?.legible;
                      return (
                        <div key={f.key} className="flex items-baseline justify-between gap-3">
                          <dt className="shrink-0 text-muted-foreground">{f.key}</dt>
                          <dd className="flex min-w-0 items-baseline justify-end gap-1.5">
                            {canLocate && avaluoFile && (
                              <button
                                type="button"
                                aria-label={`Ver origen de ${f.key}`}
                                title="Ver origen en el documento"
                                onClick={() =>
                                  setEvidence({
                                    file: avaluoFile,
                                    fieldLabel: f.key,
                                    box: fv?.box,
                                    page: fv?.page,
                                  })
                                }
                                className="no-print flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Target width={13} height={13} />
                              </button>
                            )}
                            <span
                              className={cn(
                                "min-w-0 truncate text-right font-mono tabular",
                                fv?.legible ? "" : "italic text-muted-foreground/60",
                              )}
                              title={fv?.legible ? fv.value ?? undefined : "no legible"}
                            >
                              {fv?.legible ? fv.value : "no legible"}
                            </span>
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </details>
              </Card>
            );
          })}
        </div>
      </section>

      {evidence && (
        <EvidenceViewer
          file={evidence.file}
          box={evidence.box}
          page={evidence.page}
          fieldLabel={evidence.fieldLabel}
          onClose={() => setEvidence(null)}
        />
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

// ── Special layout for rule 10 (Deslindes del predio) ────────────────────────
// Sources come in pairs: "Formulario (Norte)" / "Dominio vigente (Norte)" for
// each of the four cardinals. We group them into a 2-column table so the user
// can read and compare the full text side-by-side without truncation.
const CARDINALS = ["Norte", "Sur", "Oriente", "Poniente"] as const;

function DeslindesSourceList({ sources }: { sources: SourceValue[] }) {
  // Build a map: cardinal → { formulario, cbr }
  type Pair = { formulario: string | null; cbr: string | null };
  const pairs: Record<string, Pair> = {};
  for (const cardinal of CARDINALS) {
    pairs[cardinal] = { formulario: null, cbr: null };
  }
  for (const s of sources) {
    for (const cardinal of CARDINALS) {
      if (s.source === `Formulario (${cardinal})`) {
        pairs[cardinal].formulario = s.value;
      } else if (s.source === `Dominio vigente (${cardinal})`) {
        pairs[cardinal].cbr = s.value;
      }
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3 text-xs">
      {CARDINALS.map((cardinal) => {
        const { formulario, cbr } = pairs[cardinal];
        return (
          <div key={cardinal} className="grid gap-2 sm:grid-cols-2">
            {/* Formulario column */}
            <div>
              <p className="mb-0.5 font-semibold text-muted-foreground">
                Formulario ({cardinal})
              </p>
              <p
                className={cn(
                  "whitespace-normal break-words font-mono",
                  formulario ? "" : "italic text-muted-foreground/60",
                )}
              >
                {formulario ?? "—"}
              </p>
            </div>
            {/* Dominio vigente column */}
            <div>
              <p className="mb-0.5 font-semibold text-muted-foreground">
                Dominio vigente ({cardinal})
              </p>
              <p
                className={cn(
                  "whitespace-normal break-words font-mono",
                  cbr ? "" : "italic text-muted-foreground/60",
                )}
              >
                {cbr ?? "—"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Selects the right sources renderer depending on the rule. */
function RuleSources({ r }: { r: RuleResult }) {
  if (r.sources.length === 0) return null;

  // Special case: deslindes rule (id 10) needs full, unwrapped text.
  if (r.id === 10) {
    return <DeslindesSourceList sources={r.sources} />;
  }

  // Default: compact 2-column truncated layout for all other rules.
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-border pt-3 text-xs sm:grid-cols-2">
      {r.sources.map((s, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-muted-foreground">{s.source}</dt>
          <dd
            className={cn(
              "min-w-0 truncate text-right font-mono tabular",
              s.value ? "" : "italic text-muted-foreground/60",
            )}
            title={s.value ?? undefined}
          >
            {s.value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
