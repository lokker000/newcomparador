import type { RuleStatus } from "../types";

// ───────────────────────────────────────────────────────────────
// Superficie del predio.
// Convierte distintas expresiones a metros cuadrados para comparar
// numéricamente con tolerancia (formulario puede venir en hectáreas
// y el avalúo en m², etc.). Formato chileno: "." miles, "," decimal.
// ───────────────────────────────────────────────────────────────

/** Convierte un texto de superficie a m². Devuelve null si no se puede. */
export function parseSuperficieM2(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const isHa = /(hect|h[aá]s?\b)/.test(s);

  // Quitar las unidades ANTES de extraer dígitos: "m2"/"mt2" traen un 2 que
  // contaminaría el número. Luego tomamos el primer número del texto.
  const cleaned = s
    .replace(/hect[aá]reas?/g, " ")
    .replace(/h[aá]s?\b/g, " ")
    .replace(/metros?\s*cuadrados?/g, " ")
    .replace(/mts?\.?\s*2/g, " ")
    .replace(/m\s*[²2]/g, " ");

  const match = cleaned.match(/\d[\d.,]*/);
  if (!match) return null;
  let num = match[0];

  if (num.includes(",")) {
    // coma decimal → quitar puntos de miles, coma a punto
    num = num.replace(/\./g, "").replace(",", ".");
  } else {
    // solo puntos: si parecen separadores de miles (1.234 / 12.345), unir
    const parts = num.split(".");
    if (parts.length > 1 && parts.slice(1).every((p) => p.length === 3)) {
      num = parts.join("");
    }
  }

  const val = parseFloat(num);
  if (Number.isNaN(val) || val <= 0) return null;
  return isHa ? val * 10000 : val;
}

/**
 * Compara varias superficies.
 *  - iguales (≤0,5% de diferencia) → ok
 *  - diferencia chica (≤2%)        → warn (⚠️ difiere)
 *  - diferencia grande             → mismatch
 *  - menos de 2 valores legibles   → missing
 */
export function compareSuperficie(values: (string | null)[]): RuleStatus {
  const nums = values
    .map(parseSuperficieM2)
    .filter((n): n is number => n !== null);

  if (nums.length < 2) return "missing";

  const max = Math.max(...nums);
  const min = Math.min(...nums);
  const diff = (max - min) / max;

  if (diff <= 0.005) return "ok";
  if (diff <= 0.02) return "warn";
  return "mismatch";
}
