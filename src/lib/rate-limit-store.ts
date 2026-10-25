export interface RateLimitStore {
  consume(key: string, maximum: number, windowMs: number, now: number): Promise<{
    admitted: boolean;
    timestamps: number[];
  }>;
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super('The request quota service is temporarily unavailable. Please try again shortly.');
    this.name = 'RateLimitUnavailableError';
  }
}

export class PostgresRateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly scope: string,
    private readonly maximum: number,
    private readonly windowMs: number,
    private readonly hashIdentifier: (identifier: string) => string = (value) => value,
    private readonly clock: () => number = Date.now,
  ) {}

  async limit(identifier: string) {
    const now = this.clock();
    try {
      const result = await this.store.consume(
        `${this.scope}:${this.hashIdentifier(identifier)}`, this.maximum, this.windowMs, now,
      );
      const active = result.timestamps.filter((stamp) => stamp > now - this.windowMs);
      return {
        success: result.admitted,
        limit: this.maximum,
        remaining: Math.max(0, this.maximum - active.length),
        reset: (active[0] ?? now) + this.windowMs,
      };
    } catch (error) {
      // Do not include connection strings, credentials, or user identifiers.
      console.error('[RATE_LIMIT_STORE_ERROR]', {
        scope: this.scope,
        type: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new RateLimitUnavailableError();
    }
  }
}
