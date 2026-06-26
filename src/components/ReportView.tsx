"use client";

import type { ExtractedDocument, Report, RuleStatus } from "@/lib/types";
import { DOC_LABELS } from "@/lib/documents";
import { DOC_SPECS } from "@/lib/extraction/schemas";

const STATUS_META: Record<
  RuleStatus,
  { icon: string; label: string; chip: string }
> = {
  ok: {
    icon: "✅",
    label: "Coincide",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  mismatch: {
    icon: "❌",
    label: "No coincide",
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  warn: {
    icon: "⚠️",
    label: "Difiere",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  expired: {
    icon: "⛔",
    label: "Vencido",
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  missing: {
    icon: "❔",
    label: "Falta / no legible",
    chip: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export default function ReportView({
  report,
  documents,
}: {
  report: Report;
  documents: ExtractedDocument[];
}) {
  const conforme = report.veredicto === "conforme";
  const fecha = new Date(report.generatedAt).toLocaleString("es-CL");

  return (
    <div className="print-area space-y-6">
      {/* Veredicto general */}
      <div
        className={`rounded-2xl border p-5 ${
          conforme
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
            : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{conforme ? "✅" : "⚠️"}</span>
          <div>
            <h2 className="text-lg font-bold">
              {conforme ? "Todo conforme" : "Hay observaciones"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Solicitante:{" "}
              <strong>{report.tipo === "sociedad" ? "Sociedad jurídica" : "Persona natural"}</strong>
              {" · "}Generado: {fecha}
            </p>
          </div>
        </div>
      </div>

      {/* Resultados regla por regla */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Verificación campo por campo
        </h3>
        <div className="space-y-3">
          {report.results.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <div
                key={r.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <span className="text-zinc-400">#{r.id}</span> {r.label}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{r.detail}</p>
                {r.sources.length > 0 && (
                  <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    {r.sources.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <dt className="shrink-0 text-zinc-500">{s.source}:</dt>
                        <dd className={s.value ? "" : "italic text-zinc-400"}>
                          {s.value ?? "—"}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Datos extraídos por documento */}
      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Datos extraídos por documento
        </h3>
        <div className="space-y-3">
          {documents.map((doc) => (
            <details
              key={doc.docType}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {DOC_LABELS[doc.docType]}
                {doc.error && <span className="ml-2 text-xs text-red-600">⚠ {doc.error}</span>}
              </summary>
              <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                {DOC_SPECS[doc.docType].fields.map((f) => {
                  const fv = doc.fields[f.key];
                  return (
                    <div key={f.key} className="flex gap-2">
                      <dt className="shrink-0 text-zinc-500">{f.key}:</dt>
                      <dd className={fv?.legible ? "" : "italic text-zinc-400"}>
                        {fv?.legible ? fv.value : "no legible"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
