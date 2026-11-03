import { createHash, timingSafeEqual } from "node:crypto";

// Store access codes come from ACCESS_CODES, comma-separated. Each pilot store gets its own.
export function parseCodes(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((c) => c.trim()).filter((c) => c.length >= 6);
}

const digest = (s: string) => createHash("sha256").update(s).digest();

// Constant-time per code, so response timing does not leak how much of a code was right.
export function codeMatches(given: unknown, codes: string[]): boolean {
  if (typeof given !== "string" || given.length === 0 || given.length > 200) return false;
  const g = digest(given.trim());
  let ok = false;
  for (const code of codes) ok = timingSafeEqual(g, digest(code)) || ok;
  return ok;
}

// Sliding-window limit per key (the client IP). In memory: fine for one server process.
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}

  hit(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((h) => h > t - this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfterSec: Math.ceil((recent[0] + this.windowMs - t) / 1000) };
    }
    recent.push(t);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(t);
    return { ok: true };
  }

  private prune(t: number) {
    for (const [key, list] of this.hits) if (list.every((h) => h <= t - this.windowMs)) this.hits.delete(key);
  }
}
