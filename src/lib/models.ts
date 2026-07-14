export type Provider = 'google' | 'anthropic' | 'openai';

export interface ModelConfig {
  id: string;
  label: string;
  provider: Provider;
  requiresKey: boolean;
}

export const MODEL_CATALOG: ModelConfig[] = [
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'google',
    requiresKey: false,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    requiresKey: false,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
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
