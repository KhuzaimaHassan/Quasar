import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if rate limiting should be enabled
const isRateLimitingEnabled = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = isRateLimitingEnabled 
  ? Redis.fromEnv() 
  : new Redis({ url: 'https://placeholder.upstash.io', token: 'placeholder' });

// Dummy limiter for local development when Upstash is not configured
const dummyLimiter = {
  limit: async () => ({ success: true, limit: 100, remaining: 99, reset: Date.now() }),
};

export const chatRateLimiter = isRateLimitingEnabled 
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: '@upstash/ratelimit/chat',
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : dummyLimiter as any;

export const uploadRateLimiter = isRateLimitingEnabled
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: '@upstash/ratelimit/upload',
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : dummyLimiter as any;

export const agentRunRateLimiter = isRateLimitingEnabled
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 h'),
      analytics: true,
      prefix: '@upstash/ratelimit/agent',
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : dummyLimiter as any;
