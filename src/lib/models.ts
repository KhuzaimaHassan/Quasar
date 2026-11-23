export type Provider = 'google' | 'anthropic' | 'openai';

export interface ModelConfig {
  id: string;
  label: string;
  provider: Provider;
  requiresKey: boolean;
}

export const DEFAULT_MODEL_ID = 'gemini-3.5-flash-lite';
export const BACKGROUND_MODEL_ID = 'gemini-3.5-flash-lite';

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'gemini-1.5-flash': BACKGROUND_MODEL_ID,
  'gemini-3.5-flash': BACKGROUND_MODEL_ID,
  // These server-key models have not been reliable in the current deployment.
  'gemini-3.8-flash': BACKGROUND_MODEL_ID,
  'gemini-4-hydrogen': BACKGROUND_MODEL_ID,
};

export function resolveModelId(modelId: string): string {
  return Object.hasOwn(LEGACY_MODEL_ALIASES, modelId) ? LEGACY_MODEL_ALIASES[modelId] : modelId;
}

const HISTORICAL_MODEL_LABELS: Record<string, string> = {
  'gemini-1.5-flash': 'Gemini 1.5 Flash',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-4-hydrogen': 'Gemini 4 Hydrogen',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
};

export function getModelLabel(modelId: string): string {
  return MODEL_CATALOG.find((model) => model.id === modelId)?.label
    ?? (Object.hasOwn(HISTORICAL_MODEL_LABELS, modelId) ? HISTORICAL_MODEL_LABELS[modelId] : undefined)
    ?? modelId;
}

export const MODEL_CATALOG: ModelConfig[] = [
  {
    id: BACKGROUND_MODEL_ID,
    label: 'Gemini 3.5 Flash-Lite',
    provider: 'google',
    requiresKey: false,
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    provider: 'google',
    requiresKey: false,
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    provider: 'google',
    requiresKey: false,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    requiresKey: true,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'anthropic',
    requiresKey: true,
  },
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    requiresKey: true,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    requiresKey: true,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    requiresKey: true,
  },
];
