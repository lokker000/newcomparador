// ───────────────────────────────────────────────────────────────
// RUT / RUN chilenos.
// Normaliza a "cuerpo-DV" sin puntos, DV en mayúscula, sin ceros a la
// izquierda. Así "12.345.678-5" == "12345678-5" == "012345678-5".
// ───────────────────────────────────────────────────────────────

/** Devuelve el RUT normalizado "12345678-9" o "" si no es válido como cadena. */
export function normalizeRut(s: string | null | undefined): string {
  if (!s) return "";
  const cleaned = s.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length < 2) return "";
  const body = cleaned.slice(0, -1).replace(/^0+/, "");
  const dv = cleaned.slice(-1);
  if (body === "") return "";
  return `${body}-${dv}`;
}

/** Calcula el dígito verificador (módulo 11) para el cuerpo dado. */
export function computeDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** ¿El RUT es matemáticamente válido (DV correcto)? */
export function isValidRut(s: string | null | undefined): boolean {
  const norm = normalizeRut(s);
  if (!norm) return false;
  const [body, dv] = norm.split("-");
  if (!/^\d+$/.test(body)) return false;
  return computeDv(body) === dv;
}

export function rutEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeRut(a);
  const nb = normalizeRut(b);
  return na !== "" && na === nb;
}
