import "server-only";

// ───────────────────────────────────────────────────────────────
// Guardas de seguridad para endpoints públicos (best-effort).
//
// Limitaciones honestas:
// - El rate-limit vive EN MEMORIA del proceso. En serverless/multi-instancia
//   (Vercel, varios pods) cada instancia tiene su propio contador, así que el
//   límite real es por instancia, no global. Para límite duro usar Redis/Upstash.
// - getClientIp confía en cabeceras de proxy (x-forwarded-for). Solo es fiable
//   si la app está detrás de un proxy que las setea (Vercel/NGINX). Spoofeable
//   si el endpoint queda expuesto directo.
// ───────────────────────────────────────────────────────────────

const WINDOW_MS = 60_000; // ventana de 1 min
const MAX_REQ_PER_WINDOW = 20; // por IP por ventana

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** IP del cliente a partir de cabeceras de proxy. "unknown" si no hay. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** true si la IP puede seguir; false si superó el límite en la ventana actual. */
export function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now >= b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_REQ_PER_WINDOW) return false;
  b.count++;
  return true;
}

/**
 * Bloquea peticiones cross-origin de navegador. Si viene cabecera Origin y NO
 * coincide con el Host, se rechaza. Si no hay Origin (p. ej. curl), se permite
 * (el rate-limit cubre el abuso por script).
 */
export function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
