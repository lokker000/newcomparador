// ───────────────────────────────────────────────────────────────
// Normalización y comparación de texto.
// Antes de comparar dos valores hay que normalizarlos: mayúsculas,
// sin tildes, sin puntuación de más, espacios colapsados. Así
// "José Pérez" == "JOSE PEREZ" y "S.A." == "SA".
// ───────────────────────────────────────────────────────────────

/** Normaliza texto genérico para comparar. */
export function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes/diacríticos
    .toUpperCase()
    .replace(/[.,;:_/\\-]/g, " ") // puntuación → espacio
    .replace(/\s+/g, " ")
    .trim();
}

/** Igualdad de texto normalizada (ambos deben tener contenido). */
export function textEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return na !== "" && na === nb;
}

// Equivalencias de sufijos societarios para comparar razones sociales.
const COMPANY_SUFFIXES: [RegExp, string][] = [
  [/\bSOCIEDAD ANONIMA\b/g, "SA"],
  [/\bS A\b/g, "SA"],
  [/\bSOCIEDAD POR ACCIONES\b/g, "SPA"],
  [/\bS P A\b/g, "SPA"],
  [/\bSOCIEDAD DE RESPONSABILIDAD LIMITADA\b/g, "LTDA"],
  [/\bLIMITADA\b/g, "LTDA"],
  [/\bL T D A\b/g, "LTDA"],
  [/\bEMPRESA INDIVIDUAL DE RESPONSABILIDAD LIMITADA\b/g, "EIRL"],
  [/\bE I R L\b/g, "EIRL"],
];

/** Normaliza razón social (unifica S.A. / Sociedad Anónima, Ltda, SpA...). */
export function normalizeCompany(s: string | null | undefined): string {
  let t = normalizeText(s);
  for (const [re, rep] of COMPANY_SUFFIXES) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

export function companyEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  return na !== "" && na === nb;
}

/**
 * Normaliza un rol de avalúo. El rol viene en segmentos (p. ej. "00043-0183")
 * y a veces con ceros a la izquierda en CADA segmento. Se quitan esos ceros
 * por segmento, no del string entero, para que "00043-0183" == "43-183".
 * normalizeText ya pasó los separadores (-, /, etc.) a espacios.
 */
export function normalizeRol(s: string | null | undefined): string {
  return normalizeText(s)
    .split(" ")
    .map((seg) => seg.replace(/[^0-9A-Z]/g, "").replace(/^0+(?=.)/, "")) // ceros izq, deja ≥1 char
    .filter(Boolean)
    .join("-");
}

export function rolEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeRol(a);
  const nb = normalizeRol(b);
  return na !== "" && na === nb;
}

/**
 * Igualdad numérica por dígitos: ignora puntos, espacios y demás separadores.
 * "1.200" == "1200", "N° 1064" == "1064". Para fojas/número/año de inscripción.
 */
export function digitsEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  return da !== "" && da === db;
}

/**
 * Normaliza un texto de deslinde para comparar.
 * Aplica normalizeText y luego elimina un token cardinal INICIAL si lo hay,
 * ya que el CBR suele anteponer la orientación ("NORTE, en…") mientras el
 * formulario la omite ("En sesenta y cuatro metros…").
 *
 * Después de normalizeText el texto ya está en mayúsculas sin tildes y la
 * puntuación (coma, guion, etc.) ya es un espacio, así que el patrón a
 * eliminar es: opcional "AL " + cardinal + separadores opcionales (espacios).
 *
 * Solo se elimina si el string COMIENZA con ese patrón (no a mitad del texto).
 */
export function normalizeDeslinde(s: string | null | undefined): string {
  const base = normalizeText(s);
  if (!base) return "";
  // Tras normalizeText: todo mayúsculas, sin tildes, puntuación→espacio, espacios colapsados.
  // Un token cardinal al inicio luce así: "NORTE " o "AL NORTE " (con espacio o al final de str).
  const CARDINAL_PREFIX =
    /^(?:AL\s+)?(?:NORTE|SUR|ORIENTE|ESTE|PONIENTE|OESTE)\s*/;
  return base.replace(CARDINAL_PREFIX, "").trim();
}

/** Tokens significativos de un nombre (descarta palabras de 1 letra). */
export function nameTokens(s: string | null | undefined): string[] {
  return normalizeText(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

/**
 * ¿Dos nombres se refieren a la misma persona?
 * Compara como conjuntos de tokens (tolera distinto orden y nombres del
 * medio faltantes). Requiere compartir la mayoría de los tokens del más corto.
 */
export function nameMatches(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const A = new Set(nameTokens(a));
  const B = nameTokens(b);
  if (A.size === 0 || B.length === 0) return false;
  const common = B.filter((t) => A.has(t)).length;
  const min = Math.min(A.size, B.length);
  return common >= Math.max(2, Math.ceil(min * 0.6));
}
