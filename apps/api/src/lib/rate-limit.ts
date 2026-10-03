import { tooMany } from "./errors.ts";

/** Cửa sổ cố định trong bộ nhớ. Production nhiều instance: thay bằng Redis (cùng giao diện). */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private now: () => Date) {}
  check(key: string, max: number, windowMs: number): void {
    const t = this.now().getTime();
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= t) { this.hits.set(key, { count: 1, resetAt: t + windowMs }); return; }
    cur.count += 1;
    if (cur.count > max) throw tooMany();
  }
  reset(key: string): void { this.hits.delete(key); }
}
