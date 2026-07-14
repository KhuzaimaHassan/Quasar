import { z } from "zod";

export const apiKeySchema = z.object({
  provider: z.enum(["anthropic", "openai", "google"]),
  apiKey: z.string().min(1, "API key cannot be empty"),
});

export type ApiKeyInput = z.infer<typeof apiKeySchema>;
