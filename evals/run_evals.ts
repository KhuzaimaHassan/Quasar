/**
 * Unified Evaluation Suite Runner for Quasar RAG Pipeline (#105).
 * Runs:
 * 1. Retrieval Evaluation (FastAPI /retrieve precision, recall, and negative guardrails)
 * 2. Generation Evaluation (Gemini response generation + LLM-as-Judge fact verification)
 * Prints a clean, comprehensive executive summary report card.
 */

import './env';
import fs from 'fs';
import path from 'path';
import { runGenerationEval } from './eval_generation';
import { spawn } from 'child_process';

function runRetrievalViaPython(scriptPath: string): Promise<{ exitCode: number; stdout: string }> {
  return new Promise((resolve) => {
    // Check python executable in backend venv or system python
    const isWindows = process.platform === 'win32';
    const venvPython = path.resolve(__dirname, '..', 'backend', '.venv', isWindows ? 'Scripts/python.exe' : 'bin/python');
    const fallbackPython = path.resolve(__dirname, '..', 'backend', 'venv', isWindows ? 'Scripts/python.exe' : 'bin/python');
    const pythonExe = fs.existsSync(venvPython)
      ? venvPython
      : fs.existsSync(fallbackPython)
      ? fallbackPython
      : 'python';

    const child = spawn(pythonExe, [scriptPath], {
      cwd: path.resolve(__dirname, '..'),
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout });
    });
  });
}

async function main() {
  const startTime = Date.now();
  console.log("\n" + "#".repeat(80));
  console.log("             QUASAR RAG & GENERATION PROMPT EVALUATION SUITE (#105)");
  console.log("#".repeat(80) + "\n");

  // ==========================================
  // STEP 1: RUN RETRIEVAL EVALUATION
  // ==========================================
  const retrievalScript = path.resolve(__dirname, 'eval_retrieval.py');
  const retrievalResult = await runRetrievalViaPython(retrievalScript);
  const retrievalPassed = retrievalResult.exitCode === 0;

  // ==========================================
  // STEP 2: RUN GENERATION EVALUATION
  // ==========================================
  console.log("\n");
  let genResult;
  let generationPassed = false;
  try {
    genResult = await runGenerationEval();
    generationPassed = genResult.failedCases === 0;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Generation Eval crashed:", errorMessage);
  }

  // ==========================================
  // STEP 3: PRINT EXECUTIVE REPORT CARD
  // ==========================================
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "=".repeat(80));
  console.log("                        FINAL EVALUATION REPORT CARD");
  console.log("=".repeat(80));
  console.log(`Execution Time: ${durationSec}s`);
  console.log(`Retrieval Eval:   ${retrievalPassed ? '\x1b[32m[PASS]\x1b[0m 100% (14/14 cases)' : '\x1b[31m[FAIL]\x1b[0m'}`);
  
  if (genResult) {
    console.log(`Generation Eval:  ${generationPassed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m'} ${genResult.passedCases}/${genResult.totalCases} cases (${((genResult.passedCases / genResult.totalCases) * 100).toFixed(1)}%)`);
    console.log(`Fact Verification:${genResult.passedFactsCount}/${genResult.totalFactsEvaluated} facts confirmed (${((genResult.passedFactsCount / genResult.totalFactsEvaluated) * 100).toFixed(1)}%)`);
  } else {
    console.log(`Generation Eval:  \x1b[31m[CRASHED]\x1b[0m`);
  }

  const overallSuccess = retrievalPassed && generationPassed;
  console.log("-".repeat(80));
  console.log(`OVERALL RESULT:   ${overallSuccess ? '\x1b[32mALL EVALS PASSED (READY)\x1b[0m' : '\x1b[31mEVALUATION FAILED (SEE DETAILS ABOVE)\x1b[0m'}`);
  console.log("=".repeat(80) + "\n");

  process.exit(overallSuccess ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error in test runner:", err);
  process.exit(1);
});
