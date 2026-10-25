export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  note?: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-3.6-flash': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    effectiveFrom: '2026-01-01',
    note: 'Free tier'
  },
  'gemini-3.5-flash-lite': {
    inputPerMillion: 0,
    outputPerMillion: 0,
    effectiveFrom: '2026-01-01',
    note: 'Free tier'
  },
  'gemini-2.5-pro': {
    inputPerMillion: 3.50,
    outputPerMillion: 10.50, // Standard published rates for 2.5 Pro as an example
    effectiveFrom: '2026-01-01',
  },
  'claude-sonnet-5': {
    inputPerMillion: 2,
    outputPerMillion: 10,
    effectiveFrom: '2026-01-01',
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    effectiveFrom: '2026-01-01',
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 1,
    outputPerMillion: 5,
    effectiveFrom: '2026-01-01',
  },
  'gpt-4o': {
    inputPerMillion: 2.50,
    outputPerMillion: 10,
    effectiveFrom: '2026-01-01',
  }
};

/**
 * Estimates the cost for a given model and token usage.
 * NOTE: This is list-price estimation, not actual billing data.
 * Quasar has no visibility into a user's real invoice, caching discounts, or batch pricing.
 */
export function estimateCost(modelId: string, inputTokens: number, outputTokens: number, _date: Date = new Date()): number {
  let pricing = MODEL_PRICING[modelId];
  
  if (!pricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return inputCost + outputCost;
}
