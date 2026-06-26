// ───────────────────────────────────────────────────────────────
// Fechas. Para validar la vigencia de la cédula necesitamos parsear
// formatos chilenos: dd-mm-aaaa, dd/mm/aaaa, "12 ENE 2030", aaaa-mm-dd.
// ───────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  set: 8,
  oct: 9,
  nov: 10,
  dic: 11,
};

/** Parsea una fecha en varios formatos. Devuelve null si no reconoce. */
export function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  let m: RegExpMatchArray | null;

  // aaaa-mm-dd (ISO)
  m = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (m) return build(+m[3], +m[2] - 1, +m[1]);

  // dd-mm-aaaa  / dd/mm/aa
  m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let y = +m[3];
    if (y < 100) y += 2000;
    return build(+m[1], +m[2] - 1, y);
  }

  // dd mon aaaa (12 ene 2030 / 12 de enero de 2030)
  m = s.match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]{3,})\.?\s*(?:de\s*)?(\d{4})/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3)];
    if (mo !== undefined) return build(+m[1], mo, +m[3]);
  }

  return null;
}

function build(d: number, mo: number, y: number): Date | null {
  const dt = new Date(y, mo, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getDate() !== d || dt.getMonth() !== mo) return null; // overflow
  return dt;
}

/** ¿La fecha es hoy o futura (al final del día)? */
export function isVigente(d: Date, now: Date = new Date()): boolean {
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return endOfDay.getTime() >= now.getTime();
}
