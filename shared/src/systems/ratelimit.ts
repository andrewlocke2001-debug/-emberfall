/**
 * A small sliding-window rate limiter. Pure and deterministic (pass `now` for
 * tests). Used server-side to throttle chat (and reusable for other abusable
 * actions). Keyed by an arbitrary string (e.g. a session id).
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record an attempt; returns true if it's allowed, false if over the limit. */
  allow(key: string, now: number = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drop a key's history (e.g. when a client disconnects). */
  forget(key: string): void {
    this.hits.delete(key);
  }
}
