export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  note?: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-3.5-flash': {
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
    effectiveUntil: '2026-08-31',
    // TODO: Update to $3/$15 taking effect 2026-09-01
  },
  // Active pricing for claude-sonnet-5 starting Sept 2026
  'claude-sonnet-5-future': {
    inputPerMillion: 3,
    outputPerMillion: 15,
    effectiveFrom: '2026-09-01',
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
export function estimateCost(modelId: string, inputTokens: number, outputTokens: number, date: Date = new Date()): number {
  let pricing = MODEL_PRICING[modelId];
  
  // Handle Claude time-based pricing
  if (modelId === 'claude-sonnet-5') {
    const cutoff = new Date('2026-09-01T00:00:00Z');
    if (date >= cutoff) {
      pricing = MODEL_PRICING['claude-sonnet-5-future'];
    }
  }

  if (!pricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;

  return inputCost + outputCost;
}
