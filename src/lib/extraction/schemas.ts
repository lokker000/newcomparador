import type { DocType } from "../types";

// ───────────────────────────────────────────────────────────────
// Qué campos saca la IA de cada documento.
// IMPORTANTE: la IA SOLO extrae datos (no compara, no decide). Las
// reglas viven en el motor (../rules/engine.ts). Para agregar un campo,
// se agrega aquí; para cambiar una regla, se toca el motor. Así el
// sistema es predecible y auditable.
// ───────────────────────────────────────────────────────────────

export interface FieldSpec {
  key: string;
  hint: string;
}

export interface DocSpec {
  label: string;
  /** Contexto del documento para guiar a la IA. */
  description: string;
  fields: FieldSpec[];
}

export const DOC_SPECS: Record<DocType, DocSpec> = {
  formulario: {
    label: "Formulario de solicitud de certificación de subdivisión de predios rústicos",
    description:
      "Formulario que llena el cliente (persona natural o sociedad). Es la verdad declarada que se verifica contra el resto.",
    fields: [
      { key: "tipo_solicitante", hint: "'natural' o 'sociedad' según quién solicita" },
      { key: "nombre_solicitante", hint: "Nombre completo del solicitante persona natural" },
      { key: "run_solicitante", hint: "RUN del solicitante (con dígito verificador)" },
      { key: "razon_social", hint: "Razón social si el solicitante es una sociedad" },
      { key: "rut_empresa", hint: "RUT de la empresa si es sociedad" },
      { key: "representante_legal", hint: "Nombre del representante legal si es sociedad" },
      { key: "rol_predio", hint: "Rol de avalúo / rol del predio (SII)" },
      { key: "superficie", hint: "Superficie del predio con su unidad (m2 o hectáreas)" },
      { key: "comuna", hint: "Comuna donde está el predio" },
      { key: "ubicacion", hint: "Ubicación o dirección del predio" },
      { key: "region", hint: "Región del predio" },
    ],
  },
  avaluo: {
    label: "Certificado de avalúo fiscal detallado (SII)",
    description: "Documento oficial del SII con los datos tributarios del predio.",
    fields: [
      { key: "rol_predio", hint: "Rol de avalúo del predio (formato 'NNN-NN')" },
      { key: "propietario", hint: "Nombre del propietario según el SII" },
      { key: "comuna", hint: "Comuna del predio" },
      { key: "direccion", hint: "Dirección o ubicación del predio" },
      { key: "superficie", hint: "Superficie del terreno con unidad" },
      { key: "avaluo_fiscal", hint: "Monto del avalúo fiscal total" },
    ],
  },
  cbr: {
    label: "Inscripción de dominio — Conservador de Bienes Raíces",
    description:
      "Inscripción de dominio vigente. Acredita el propietario actual y la individualización del predio.",
    fields: [
      { key: "propietario", hint: "Propietario vigente según la inscripción" },
      { key: "fojas", hint: "Fojas de la inscripción" },
      { key: "numero_inscripcion", hint: "Número de la inscripción" },
      { key: "anio_inscripcion", hint: "Año de la inscripción" },
      { key: "rol_predio", hint: "Rol del predio si aparece" },
      { key: "comuna", hint: "Comuna del predio" },
      { key: "superficie", hint: "Superficie del predio con unidad" },
      { key: "deslindes", hint: "Deslindes del predio (norte, sur, este, oeste)" },
      { key: "representante_legal", hint: "Representante legal si el titular es sociedad" },
    ],
  },
  cedula_frente: {
    label: "Cédula de identidad chilena — lado frontal",
    description: "Lado frontal de la cédula de identidad.",
    fields: [
      { key: "nombre", hint: "Nombres (de pila) del titular" },
      { key: "apellidos", hint: "Apellidos del titular" },
      { key: "run", hint: "RUN del titular (con dígito verificador)" },
      { key: "fecha_nacimiento", hint: "Fecha de nacimiento" },
    ],
  },
  cedula_reverso: {
    label: "Cédula de identidad chilena — lado posterior",
    description: "Lado posterior de la cédula. Aquí está la fecha de vencimiento.",
    fields: [
      { key: "run", hint: "RUN si aparece en el reverso" },
      { key: "fecha_vencimiento", hint: "Fecha de vencimiento / validez de la cédula" },
      { key: "numero_documento", hint: "Número de documento de la cédula" },
    ],
  },
  erut: {
    label: "Rol Único Tributario electrónico (e-RUT, SII)",
    description: "e-RUT de la empresa. Acredita razón social, RUT y representante.",
    fields: [
      { key: "razon_social", hint: "Razón social de la empresa" },
      { key: "rut_empresa", hint: "RUT de la empresa (con dígito verificador)" },
      { key: "representante_legal", hint: "Representante legal de la empresa" },
      { key: "direccion", hint: "Dirección o domicilio de la empresa" },
    ],
  },
};

/** Prompt de extracción para un documento. */
export function buildPrompt(docType: DocType): string {
  const spec = DOC_SPECS[docType];
  const lines = spec.fields.map((f) => `- ${f.key}: ${f.hint}`).join("\n");
  return [
    `Eres un extractor de datos. Documento: "${spec.label}".`,
    spec.description,
    "",
    "Extrae EXACTAMENTE los siguientes campos y devuélvelos como JSON:",
    lines,
    "",
    "Reglas estrictas:",
    "- Si un campo no aparece o no es legible, devuelve null. NUNCA inventes ni adivines.",
    "- Transcribe los valores tal cual aparecen (no corrijas ni normalices).",
    "- No agregues campos que no se pidieron.",
  ].join("\n");
}

/** Construye el responseSchema (subset OpenAPI de Gemini) para un documento. */
export function buildResponseSchema(docType: DocType): Record<string, unknown> {
  const spec = DOC_SPECS[docType];
  const properties: Record<string, unknown> = {};
  for (const f of spec.fields) {
    properties[f.key] = {
      type: "STRING",
      nullable: true,
      description: f.hint,
    };
  }
  return {
    type: "OBJECT",
    properties,
    required: spec.fields.map((f) => f.key),
  };
}
