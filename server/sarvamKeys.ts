// Several Sarvam API keys (SARVAM_API_KEY="key1,key2,key3"), used one at a
// time. A key whose account fails (402 no credits, 401/403 bad or revoked
// key) is skipped for a while and the next key answers the same request, so
// one account running dry never sends children to the robotic fallbacks
// while another still has credits.

export function parseSarvamKeys(raw: string | undefined): string[] {
  const keys = String(raw || "")
    .split(/[\s,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

export function isSarvamAccountProblem(status: number): boolean {
  return status === 401 || status === 402 || status === 403;
}

export interface SarvamKey {
  index: number;
  value: string;
}

export class SarvamKeyPool {
  private blockedUntil: number[];
  private reasons: string[];
  private active = 0;

  constructor(
    private readonly keys: string[],
    private readonly pauseMs: number,
    private readonly now: () => number = Date.now
  ) {
    this.blockedUntil = keys.map(() => 0);
    this.reasons = keys.map(() => "");
  }

  get size(): number {
    return this.keys.length;
  }

  /** "key 2 of 3 (…Rgx8)": never the whole key in a log line. */
  label(index: number): string {
    const key = this.keys[index] || "";
    return `key ${index + 1} of ${this.keys.length} (…${key.slice(-4)})`;
  }

  private usable(index: number): boolean {
    return this.now() >= this.blockedUntil[index];
  }

  /** The key to use now: the last one that worked, else the next usable one. */
  next(): SarvamKey | null {
    for (let step = 0; step < this.keys.length; step++) {
      const index = (this.active + step) % this.keys.length;
      if (this.usable(index)) {
        this.active = index;
        return { index, value: this.keys[index] };
      }
    }
    return null;
  }

  /**
   * Records an answer for `key`. Returns true when it was an account problem
   * (the key is then skipped for `pauseMs`); `wasNew` says whether this is the
   * first such answer since the key was last usable, so callers log it once.
   */
  noteAccountProblem(key: SarvamKey, status: number, message: string): { accountProblem: boolean; wasNew: boolean } {
    if (!isSarvamAccountProblem(status)) return { accountProblem: false, wasNew: false };
    const wasNew = this.usable(key.index);
    this.blockedUntil[key.index] = this.now() + this.pauseMs;
    this.reasons[key.index] = `${message} (HTTP ${status})`;
    if (this.active === key.index) this.active = (key.index + 1) % this.keys.length;
    return { accountProblem: true, wasNew };
  }

  /** Why Sarvam can't answer at all right now, or null while a key is usable. */
  blockedReason(): string | null {
    if (this.keys.length === 0 || this.next()) return null;
    const reasons = [...new Set(this.reasons.filter(Boolean))];
    return `Sarvam unavailable: ${reasons.join("; ") || "every key failed"}`;
  }

  availableCount(): number {
    return this.keys.filter((_, index) => this.usable(index)).length;
  }
}
