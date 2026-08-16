/**
 * Generation Evaluation Script for Quasar RAG Pipeline (LLM-as-judge).
 * Reuses buildSystemPrompt and retrieveContext logic.
 * For each relevant test case with passing retrieval:
 * 1. Retrieves real chunks from FastAPI /retrieve
 * 2. Builds real context-injected system prompt
 * 3. Generates response using default production Gemini key via @ai-sdk/google (gemini-3.5-flash)
 * 4. Runs LLM-as-judge structured evaluation checking each expected fact & citation
 * 5. Reports detailed per-case and per-fact pass/fail breakdown
 */

import './env';
import fs from 'fs';
import path from 'path';
import { generateText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { retrieveContext, buildSystemPrompt } from '../src/lib/rag';

interface TestCase {
  id: string;
  question: string;
  workspaceId: string;
  expectedSourceFile: string | null;
  expectedFacts: string[];
  knownRetrievalGap?: boolean;
  observedSimilarity?: number;
  notes?: string;
}

const judgeSchema = z.object({
  sourceCited: z.boolean().describe("Whether the assistant response explicitly mentions, attributes, or cites the expected source document file name."),
  factEvaluations: z.array(
    z.object({
      fact: z.string().describe("The expected fact being evaluated."),
      present: z.boolean().describe("True if the response accurately contains or conveys this fact, false otherwise."),
      reasoning: z.string().describe("Brief 1-sentence reasoning explaining why this fact is present or missing in the response.")
    })
  ),
  overallPass: z.boolean().describe("True if all expected facts are accurately conveyed in the response and the source is properly cited.")
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Robust retry wrapper with backoff to accommodate Gemini API rate limits on free-tier keys
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 5, baseDelay = 4000): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: unknown) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      let waitTime = baseDelay * Math.pow(1.5, attempt);
      const match = errorMessage.match(/Please retry in (\d+(\.\d+)?)s/i);
      if (match && match[1]) {
        waitTime = Math.ceil(parseFloat(match[1])) * 1000 + 2000;
      }
      console.log(`    \x1b[33m[Rate Limit / Retry]\x1b[0m Waiting ${(waitTime / 1000).toFixed(1)}s before attempt ${attempt + 1}...`);
      await sleep(waitTime);
    }
  }
}

export async function runGenerationEval(goldenPath?: string) {
  const filePath = goldenPath || path.resolve(__dirname, 'golden_set.json');
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const cases: TestCase[] = JSON.parse(rawData);

  // Relevant cases that retrieve context above the production 0.70 threshold
  const activeCases = cases.filter(c => c.expectedSourceFile !== null && c.expectedFacts.length > 0 && !c.knownRetrievalGap);
  const gapCases = cases.filter(c => c.knownRetrievalGap === true);

  // Model selection: Defaults to gemini-3.5-flash-lite for free-tier quota resilience,
  // or gemini-3.5-flash when EVAL_MODEL=gemini-3.5-flash is passed for production key runs.
  const modelId = process.env.EVAL_MODEL || 'gemini-3.5-flash-lite';
  const isProxy = modelId.includes('lite');

  console.log("=" .repeat(80));
  console.log("QUASAR GENERATION EVALUATION (LLM-as-Judge)");
  console.log(`Active Test Cases (Above 0.70 Threshold): ${activeCases.length}`);
  console.log(`Known Retrieval Gaps (Below 0.70 Threshold): ${gapCases.length}`);
  console.log(`Model: ${modelId} ${isProxy ? '(Free-Tier Proxy — use EVAL_MODEL=gemini-3.5-flash for prod)' : '(Production Default)'}`);
  console.log("=" .repeat(80));

  let passedCases = 0;
  let failedCases = 0;
  let totalFactsEvaluated = 0;
  let passedFactsCount = 0;

  const results = [];

  for (let i = 0; i < activeCases.length; i++) {
    const testCase = activeCases[i];
    console.log(`\n[${i + 1}/${activeCases.length}] Testing Case: ${testCase.id}`);
    console.log(`  Question: "${testCase.question}"`);
    console.log(`  Expected Source: ${testCase.expectedSourceFile}`);

    try {
      // 1. Retrieve real context chunks
      const chunks = await retrieveContext(testCase.workspaceId, testCase.question);
      console.log(`  Retrieved: ${chunks.length} chunk(s) from FastAPI`);

      // 2. Build system prompt using exact Quasar logic
      const systemPrompt = buildSystemPrompt(chunks);

      // 3. Generate response
      const { text: responseText } = await retryWithBackoff(() =>
        generateText({
          model: google(modelId),
          system: systemPrompt,
          prompt: testCase.question,
        })
      );

      console.log(`  Assistant Response (${responseText.length} chars):`);
      console.log(`    "${responseText.replace(/\n+/g, ' ').substring(0, 140)}..."`);

      // Polite pause between generation and judge
      await sleep(1500);

      // 4. Run LLM-as-Judge to evaluate facts and citation
      const factsPrompt = testCase.expectedFacts.map((f, idx) => `${idx + 1}. ${f}`).join('\n');
      const judgePrompt = `
You are an objective evaluation judge assessing an AI assistant's generated response against expected ground-truth facts and source file attribution.

USER QUESTION:
"${testCase.question}"

EXPECTED SOURCE FILE:
"${testCase.expectedSourceFile}"

EXPECTED FACTS:
${factsPrompt}

ASSISTANT RESPONSE TO EVALUATE:
"""
${responseText}
"""

Evaluate each expected fact: is it accurately conveyed in the response?
Evaluate if the source document ("${testCase.expectedSourceFile}") is explicitly mentioned or cited in the response.
`;

      const judgeResult = await retryWithBackoff(() =>
        generateObject({
          model: google(modelId),
          schema: judgeSchema,
          system: "You are a precise, objective evaluation judge. Determine whether the provided response contains each expected fact and properly attributes the expected source document.",
          prompt: judgePrompt,
        })
      );

      const { sourceCited, factEvaluations } = judgeResult.object;

      // Check if all facts passed
      const allFactsPresent = factEvaluations.every(f => f.present);
      const isPass = allFactsPresent && sourceCited;

      if (isPass) {
        passedCases++;
        console.log(`  Case Status: \x1b[32mPASS\x1b[0m`);
      } else {
        failedCases++;
        console.log(`  Case Status: \x1b[31mFAIL\x1b[0m`);
      }

      console.log(`  Source Attribution (${testCase.expectedSourceFile}): ${sourceCited ? '\x1b[32mCITED\x1b[0m' : '\x1b[31mMISSING\x1b[0m'}`);
      console.log(`  Fact Evaluations (${factEvaluations.filter(f => f.present).length}/${testCase.expectedFacts.length}):`);

      for (const fe of factEvaluations) {
        totalFactsEvaluated++;
        if (fe.present) passedFactsCount++;
        const statusIcon = fe.present ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
        console.log(`    ${statusIcon} "${fe.fact}"`);
        console.log(`           Reason: ${fe.reasoning}`);
      }

      results.push({
        id: testCase.id,
        question: testCase.question,
        expectedSourceFile: testCase.expectedSourceFile,
        passed: isPass,
        sourceCited,
        responseText,
        factEvaluations,
      });

      // Polite pause before next case
      await sleep(3000);

    } catch (err: unknown) {
      failedCases++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`  \x1b[31mERROR evaluating case ${testCase.id}:\x1b[0m`, errorMessage);
      results.push({
        id: testCase.id,
        question: testCase.question,
        passed: false,
        error: errorMessage,
      });
    }
  }

  if (gapCases.length > 0) {
    console.log("\n" + "-".repeat(80));
    console.log(`KNOWN RETRIEVAL GAPS (Skipped Generation Eval due to 0 Chunks at 0.70 Threshold):`);
    for (const gc of gapCases) {
      console.log(`  - [${gc.id}] "${gc.question}" (Observed sim: ${gc.observedSimilarity})`);
    }
  }

  console.log("\n" + "=" .repeat(80));
  console.log(`GENERATION EVAL SUMMARY:`);
  console.log(`  Active Cases Passed: ${passedCases}/${activeCases.length} (${((passedCases / activeCases.length) * 100).toFixed(1)}%)`);
  console.log(`  Facts Verified:      ${passedFactsCount}/${totalFactsEvaluated} (${totalFactsEvaluated > 0 ? ((passedFactsCount / totalFactsEvaluated) * 100).toFixed(1) : 0}%)`);
  console.log("=" .repeat(80));

  return {
    totalCases: activeCases.length,
    passedCases,
    failedCases,
    totalFactsEvaluated,
    passedFactsCount,
    results,
  };
}

if (require.main === module) {
  runGenerationEval().then((res) => {
    process.exit(res.failedCases > 0 ? 1 : 0);
  }).catch((err) => {
    console.error("Fatal error in generation eval:", err);
    process.exit(1);
  });
}
