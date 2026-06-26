import type { DocType, TipoSolicitante } from "./types";

/** Etiqueta humana de cada documento. */
export const DOC_LABELS: Record<DocType, string> = {
  formulario: "Formulario de solicitud",
  avaluo: "Certificado de avalúo fiscal (SII)",
  cbr: "Inscripción de dominio (CBR)",
  cedula_frente: "Cédula de identidad — frente",
  cedula_reverso: "Cédula de identidad — reverso",
  erut: "e-RUT (sociedad)",
};

/** Descripción corta de para qué sirve cada documento (ayuda al operador). */
export const DOC_HELP: Record<DocType, string> = {
  formulario: "La 'verdad declarada' por el cliente. Se verifica contra todo lo demás.",
  avaluo: "Del SII. Rol, propietario, comuna, superficie y avalúo.",
  cbr: "Del Conservador de Bienes Raíces. Propietario vigente, fojas/número/año, deslindes.",
  cedula_frente: "Lado frontal: nombre, apellidos y RUN.",
  cedula_reverso: "Lado posterior: fecha de vencimiento (vigencia).",
  erut: "Solo sociedades. Razón social, RUT de la empresa y representante legal.",
};

/** Documentos requeridos según el tipo de solicitante. */
export function requiredDocs(tipo: TipoSolicitante): DocType[] {
  const base: DocType[] = [
    "formulario",
    "avaluo",
    "cbr",
    "cedula_frente",
    "cedula_reverso",
  ];
  return tipo === "sociedad" ? [...base, "erut"] : base;
}
