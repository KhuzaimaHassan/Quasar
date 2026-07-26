import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export type ExtractedFact = {
  scope: 'preference' | 'project' | 'style' | 'fact';
  key: string;
  value: string;
  confidence: number;
};

export async function extractMemories(recentMessages: any[]): Promise<ExtractedFact[]> {
  try {
    // Format messages for the prompt
    const chatHistory = recentMessages.map(m => `${m.role}: ${m.content}`).join('\n');

    const result = await generateObject({
      // We always use the server's default Google key for background extraction,
      // never a BYOK-resolved key to ensure it always runs reliably.
      model: google('gemini-3.5-flash'), // Using actual flash model name
      schema: z.object({
        facts: z.array(
          z.object({
            scope: z.enum(['preference', 'project', 'style', 'fact']),
            key: z.string().describe('A short, snake_case key identifying the fact (e.g. favorite_language)'),
            value: z.string().describe('The actual extracted information'),
            confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
          })
        ),
      }),
      system: `You are a background memory extraction agent. Your job is to read the recent chat history and extract durable, long-term facts about the user.

CRITICAL RULES:
1. Extract ONLY facts explicitly stated or strongly implied by the user. Do NEVER infer or hallucinate beyond what was directly said.
2. Skip anything resembling a password, API key, secret, or credential. Never extract sensitive security information.
3. If there are no new durable facts, return an empty array.
4. "preference" = things the user likes/dislikes (e.g., uses TypeScript). "project" = details about what they are building. "style" = how they like the AI to respond. "fact" = general objective information about the user.`,
      prompt: `Extract memories from the following chat history:\n\n${chatHistory}`,
    });

    // Filter to facts with confidence > 0.6
    return result.object.facts.filter(fact => fact.confidence > 0.6);
  } catch (error) {
    console.error('[MEMORY_EXTRACTION_ERROR] Failed to extract memories:', error);
    return []; // Return empty array on failure so it never crashes the app
  }
}
