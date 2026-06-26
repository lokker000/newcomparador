// ───────────────────────────────────────────────────────────────
// Tipos del dominio del Verificador SAG
// ───────────────────────────────────────────────────────────────

/** Tipo de solicitante. Decide qué documentos y qué reglas aplican. */
export type TipoSolicitante = "natural" | "sociedad";

/** Cada documento que entra al sistema. */
export type DocType =
  | "formulario"
  | "avaluo"
  | "cbr"
  | "cedula_frente"
  | "cedula_reverso"
  | "erut";

/**
 * Un campo extraído por la IA.
 * `legible: false` o `value: null` significan "no se pudo leer / no está".
 * La IA NUNCA inventa: si no puede leer, devuelve null.
 */
export interface FieldValue {
  value: string | null;
  legible: boolean;
}

export type ExtractedFields = Record<string, FieldValue>;

/** Resultado de extracción de un documento. */
export interface ExtractedDocument {
  docType: DocType;
  fileName: string;
  fields: ExtractedFields;
  /** Si la IA falló para este documento puntual. */
  error?: string;
}

/**
 * Estado de una regla de validación.
 * ✅ ok | ❌ mismatch | ⚠️ warn | ⛔ expired | (falta) missing
 */
export type RuleStatus = "ok" | "mismatch" | "warn" | "expired" | "missing";

/** Lo que dijo cada fuente para una regla (para mostrarlo en el informe). */
export interface SourceValue {
  source: string;
  field: string;
  value: string | null;
}

export interface RuleResult {
  id: number;
  label: string;
  status: RuleStatus;
  detail: string;
  sources: SourceValue[];
}

export interface Report {
  veredicto: "conforme" | "observaciones";
  tipo: TipoSolicitante;
  results: RuleResult[];
  generatedAt: string;
}

/** Respuesta del endpoint de extracción. */
export interface ExtractResponse {
  documents: ExtractedDocument[];
}
