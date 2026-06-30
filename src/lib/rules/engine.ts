import type {
  DocType,
  ExtractedDocument,
  Report,
  RuleResult,
  RuleStatus,
  SourceValue,
  TipoSolicitante,
} from "../types";
import { companyEquals, nameMatches, rolEquals, textEquals } from "../compare/text";
import { rutEquals } from "../compare/rut";
import { compareSuperficie } from "../compare/superficie";
import { isVigente, parseDate } from "../compare/dates";

// ───────────────────────────────────────────────────────────────
// EL MOTOR DE REGLAS (la matriz de validación, en código).
// La IA solo extrae; aquí decidimos qué tiene que coincidir con qué.
// Para agregar un chequeo nuevo: se agrega una fila a RULES. No se
// reescribe nada más.
// ───────────────────────────────────────────────────────────────

type DocMap = Partial<Record<DocType, ExtractedDocument>>;

/** Lee un campo de un documento; null si falta o no es legible. */
function field(docs: DocMap, dt: DocType, key: string): string | null {
  const f = docs[dt]?.fields[key];
  return f && f.legible ? f.value ?? null : null;
}

function cedulaNombre(docs: DocMap): string | null {
  const n = field(docs, "cedula_frente", "nombre");
  const a = field(docs, "cedula_frente", "apellidos");
  if (!n && !a) return null;
  return [n, a].filter(Boolean).join(" ");
}

function cedulaRun(docs: DocMap): string | null {
  return field(docs, "cedula_frente", "run") ?? field(docs, "cedula_reverso", "run");
}

function cedulaVencimiento(docs: DocMap): string | null {
  // En la cédula chilena vigente el vencimiento está en el FRENTE; el reverso
  // queda como respaldo (formato antiguo).
  return (
    field(docs, "cedula_frente", "fecha_vencimiento") ??
    field(docs, "cedula_reverso", "fecha_vencimiento")
  );
}

type EqFn = (a: string | null, b: string | null) => boolean;

/** Compara varias fuentes que deben coincidir entre sí. */
function evalEquality(
  id: number,
  label: string,
  sources: SourceValue[],
  eq: EqFn,
): RuleResult {
  const present = sources.filter((s) => s.value && s.value.trim());
  if (present.length < 2) {
    const faltan = sources.filter((s) => !s.value).map((s) => s.source);
    return {
      id,
      label,
      status: "missing",
      detail:
        faltan.length > 0
          ? `Datos insuficientes para comparar. Falta o no es legible en: ${faltan.join(", ")}.`
          : "Datos insuficientes para comparar.",
      sources,
    };
  }
  const ref = present[0].value;
  const allEqual = present.every((s) => eq(ref, s.value));
  return {
    id,
    label,
    status: allEqual ? "ok" : "mismatch",
    detail: allEqual
      ? "Todas las fuentes coinciden."
      : "Hay diferencias entre las fuentes.",
    sources,
  };
}

// ── Regla 1: Identidad del solicitante (nombre + RUN) ──────────────
function ruleIdentidad(docs: DocMap): RuleResult {
  const nameSources: SourceValue[] = [
    { source: "Formulario", field: "nombre_solicitante", value: field(docs, "formulario", "nombre_solicitante") },
    { source: "Cédula", field: "nombre", value: cedulaNombre(docs) },
    { source: "Avalúo (propietario)", field: "propietario", value: field(docs, "avaluo", "propietario") },
    { source: "Dominio vigente (propietario)", field: "propietario", value: field(docs, "cbr", "propietario") },
  ];
  const runSources: SourceValue[] = [
    { source: "Formulario", field: "run_solicitante", value: field(docs, "formulario", "run_solicitante") },
    { source: "Cédula", field: "run", value: cedulaRun(docs) },
  ];

  const nameStatus = statusOf(nameSources, nameMatches);
  const runStatus = statusOf(runSources, rutEquals);
  const status = worst([nameStatus, runStatus]);

  return {
    id: 1,
    label: "Identidad del solicitante (nombre + RUN)",
    status,
    detail: detailFor("Nombre", nameStatus) + " " + detailFor("RUN", runStatus),
    sources: [...nameSources, ...runSources],
  };
}

// ── Regla 5: Propietario del dominio vigente = solicitante ───────────────
function rulePropietarioVigente(docs: DocMap): RuleResult {
  const cbr = field(docs, "cbr", "propietario");
  const solicitante =
    field(docs, "formulario", "nombre_solicitante") ??
    field(docs, "formulario", "razon_social") ??
    cedulaNombre(docs);

  const sources: SourceValue[] = [
    { source: "Dominio vigente (propietario vigente)", field: "propietario", value: cbr },
    { source: "Solicitante", field: "nombre/razón social", value: solicitante },
  ];

  if (!cbr || !solicitante) {
    return {
      id: 5,
      label: "Propietario del dominio vigente = solicitante",
      status: "missing",
      detail: "Falta el propietario del Dominio vigente o el solicitante.",
      sources,
    };
  }

  const ok = nameMatches(cbr, solicitante) || companyEquals(cbr, solicitante);
  return {
    id: 5,
    label: "Propietario del dominio vigente = solicitante",
    status: ok ? "ok" : "mismatch",
    detail: ok
      ? "El propietario vigente coincide con el solicitante."
      : "El propietario vigente en el Dominio vigente NO coincide con el solicitante.",
    sources,
  };
}

// ── Regla 6: Cédula vigente ────────────────────────────────────────
function ruleCedulaVigente(docs: DocMap): RuleResult {
  const venc = cedulaVencimiento(docs);
  const sources: SourceValue[] = [
    { source: "Cédula", field: "fecha_vencimiento", value: venc },
  ];

  if (!venc) {
    return {
      id: 6,
      label: "Cédula vigente",
      status: "missing",
      detail: "No se pudo leer la fecha de vencimiento de la cédula.",
      sources,
    };
  }

  const d = parseDate(venc);
  if (!d) {
    return {
      id: 6,
      label: "Cédula vigente",
      status: "missing",
      detail: `No se pudo interpretar la fecha de vencimiento ("${venc}").`,
      sources,
    };
  }

  const vigente = isVigente(d);
  return {
    id: 6,
    label: "Cédula vigente",
    status: vigente ? "ok" : "expired",
    detail: vigente
      ? `Cédula vigente (vence ${venc}).`
      : `⛔ Cédula VENCIDA (venció ${venc}).`,
    sources,
  };
}

// ── Regla 7: (sociedad) Razón social + RUT empresa ─────────────────
function ruleSociedadDatos(docs: DocMap): RuleResult {
  const razonSources: SourceValue[] = [
    { source: "Formulario", field: "razon_social", value: field(docs, "formulario", "razon_social") },
    { source: "e-RUT", field: "razon_social", value: field(docs, "erut", "razon_social") },
  ];
  const rutSources: SourceValue[] = [
    { source: "Formulario", field: "rut_empresa", value: field(docs, "formulario", "rut_empresa") },
    { source: "e-RUT", field: "rut_empresa", value: field(docs, "erut", "rut_empresa") },
  ];

  const razonStatus = statusOf(razonSources, companyEquals);
  const rutStatus = statusOf(rutSources, rutEquals);
  const status = worst([razonStatus, rutStatus]);

  return {
    id: 7,
    label: "Sociedad: razón social + RUT empresa",
    status,
    detail: detailFor("Razón social", razonStatus) + " " + detailFor("RUT empresa", rutStatus),
    sources: [...razonSources, ...rutSources],
  };
}

// ── Regla 8: (sociedad) Representante legal ─────────────────────────
function ruleRepresentante(docs: DocMap): RuleResult {
  const sources: SourceValue[] = [
    { source: "Formulario", field: "representante_legal", value: field(docs, "formulario", "representante_legal") },
    { source: "e-RUT", field: "representante_legal", value: field(docs, "erut", "representante_legal") },
    { source: "Dominio vigente", field: "representante_legal", value: field(docs, "cbr", "representante_legal") },
  ];
  return {
    ...evalEquality(8, "Sociedad: representante legal", sources, nameMatches),
    label: "Sociedad: representante legal",
  };
}

// ───────────────────────────────────────────────────────────────
// Helpers de estado
// ───────────────────────────────────────────────────────────────

function statusOf(sources: SourceValue[], eq: EqFn): RuleStatus {
  const present = sources.filter((s) => s.value && s.value.trim());
  if (present.length < 2) return "missing";
  const ref = present[0].value;
  return present.every((s) => eq(ref, s.value)) ? "ok" : "mismatch";
}

function detailFor(name: string, st: RuleStatus): string {
  switch (st) {
    case "ok":
      return `${name}: coincide.`;
    case "mismatch":
      return `${name}: NO coincide.`;
    case "missing":
      return `${name}: datos insuficientes.`;
    default:
      return `${name}: ${st}.`;
  }
}

const SEVERITY: Record<RuleStatus, number> = {
  ok: 0,
  missing: 1,
  warn: 2,
  expired: 3,
  mismatch: 3,
};

function worst(list: RuleStatus[]): RuleStatus {
  return list.reduce((acc, s) => (SEVERITY[s] > SEVERITY[acc] ? s : acc), "ok");
}

// ───────────────────────────────────────────────────────────────
// La matriz: define qué reglas corren y para qué tipo de solicitante.
// ───────────────────────────────────────────────────────────────

interface RuleDef {
  appliesTo: (tipo: TipoSolicitante) => boolean;
  run: (docs: DocMap) => RuleResult;
}

const RULES: RuleDef[] = [
  { appliesTo: () => true, run: ruleIdentidad },
  {
    appliesTo: () => true,
    run: (docs) =>
      evalEquality(
        2,
        "Rol del predio",
        [
          { source: "Formulario", field: "rol_predio", value: field(docs, "formulario", "rol_predio") },
          { source: "Avalúo", field: "rol_predio", value: field(docs, "avaluo", "rol_predio") },
          { source: "Dominio vigente", field: "rol_predio", value: field(docs, "cbr", "rol_predio") },
        ],
        rolEquals,
      ),
  },
  {
    appliesTo: () => true,
    run: (docs) => ruleSuperficie(docs),
  },
  {
    appliesTo: () => true,
    run: (docs) =>
      evalEquality(
        4,
        "Ubicación / comuna del predio",
        [
          { source: "Formulario", field: "comuna", value: field(docs, "formulario", "comuna") },
          { source: "Avalúo", field: "comuna", value: field(docs, "avaluo", "comuna") },
          { source: "Dominio vigente", field: "comuna", value: field(docs, "cbr", "comuna") },
        ],
        textEquals,
      ),
  },
  { appliesTo: () => true, run: rulePropietarioVigente },
  { appliesTo: () => true, run: ruleCedulaVigente },
  { appliesTo: (t) => t === "sociedad", run: ruleSociedadDatos },
  { appliesTo: (t) => t === "sociedad", run: ruleRepresentante },
];

// Regla 3 con comparación numérica de superficie.
function ruleSuperficie(docs: DocMap): RuleResult {
  const sources: SourceValue[] = [
    { source: "Formulario", field: "superficie", value: field(docs, "formulario", "superficie") },
    { source: "Avalúo", field: "superficie", value: field(docs, "avaluo", "superficie") },
    { source: "Dominio vigente", field: "superficie", value: field(docs, "cbr", "superficie") },
  ];
  const status = compareSuperficie(sources.map((s) => s.value));
  const detail: Record<RuleStatus, string> = {
    ok: "Las superficies coinciden.",
    warn: "⚠️ Las superficies difieren levemente (revisar).",
    mismatch: "Las superficies NO coinciden.",
    missing: "Datos de superficie insuficientes para comparar.",
    expired: "",
  };
  return { id: 3, label: "Superficie del predio", status, detail: detail[status], sources };
}

/**
 * Punto de entrada: corre toda la matriz y arma el informe.
 * Es una función pura → fácil de testear y se puede correr en el
 * navegador (transparente y auditable).
 */
export function buildReport(
  documents: ExtractedDocument[],
  tipo: TipoSolicitante,
): Report {
  const docs: DocMap = {};
  for (const d of documents) docs[d.docType] = d;

  const results = RULES.filter((r) => r.appliesTo(tipo)).map((r) => r.run(docs));

  // Veredicto conservador: conforme solo si TODAS las reglas dan ok.
  const veredicto = results.every((r) => r.status === "ok")
    ? "conforme"
    : "observaciones";

  return {
    veredicto,
    tipo,
    results: results.sort((a, b) => a.id - b.id),
    generatedAt: new Date().toISOString(),
  };
}
