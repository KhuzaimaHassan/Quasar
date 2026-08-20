# PRD: Production RAG Evaluation Suite with RAGAS (Milestone 6)

**Status:** Ready for Architecture (`plan-architecture`)  
**Owner:** Engineering / AI Platform  
**Target Milestone:** M6 (Production Quality & Validation)  
**Spec Target:** `evals/` (architecture & engineering spec to be defined via `plan-architecture`)

---

## 1. Problem Statement

Quasar currently operates an end-to-end RAG pipeline (document parsing → chunking → Gemini embedding → pgvector cosine retrieval → BM25 RRF re-ranking → context injection → streaming generation).

While a working multi-script test harness exists in `evals/` (`eval_retrieval.py` in Python and `eval_generation.ts` / `run_evals.ts` in TypeScript), the current evaluation tooling has critical gaps:
1. **Ad-hoc and Unreliable Reporting:** The legacy generation script (`eval_generation.ts`) uses custom boolean heuristics for fact checking rather than continuous, validated industry metrics. Furthermore, the existing Python wrapper (`run_evals.py`) hardcodes summary strings (`"100% (14/14 cases)"` / `"(100% facts & citations)"`) rather than calculating real aggregate pass rates, making its report card misleading.
2. **Dual-Runtime Friction:** Evaluation is split across Node.js (`eval_generation.ts`, `run_evals.ts` using `npx tsx`) and Python (`eval_retrieval.py`, `run_evals.py`). Spawning Python child processes from Node or Node child processes from Python introduces brittle process orchestration, cross-platform path resolution issues, and dual-stack maintenance overhead.
3. **No Standardized RAG Quality Metrics:** Developers have no way to quantify how tuning chunk size (e.g. 500 tokens), overlap (60 tokens), similarity thresholds (0.70), or reranking parameters impacts **Faithfulness** (hallucination rate), **Answer Relevancy** (alignment to user intent), **Context Precision** (ranking quality of retrieved chunks), and **Context Recall** (coverage of reference facts).

---

## 2. Evidence & Existing Infrastructure Audit

1. **Audit of `docs/Lessons-Learned.md` (Issue #88, lines 224–229):**
   > **Issue #88: Semantic Retrieval & pgvector Thresholds**
   > - *Similarity Threshold Tuning with Gemini Embeddings*:
   >   - *What happened*: Retrieving chunks with `gemini-embedding-001` yielded similarity scores (e.g., `0.719`) that were dangerously close to our theoretical `0.7` cutoff, even for highly relevant chunks.
   >   - *What happened*: Different embedding models cluster vectors differently in high-dimensional space. Gemini tends to group even disparate texts somewhat closely compared to other models, meaning a generic `0.7` cosine distance threshold is actually very strict for this specific model.
   >   - *How we solved it*: We logged the exact similarity scores during retrieval (`1 - (embedding <=> query)`) to empirically validate our cutoffs. We kept `0.7` for now, but documented that it might need lowering to `0.6` or `0.65` if users experience missing context, proving that embedding thresholds cannot be blindly inherited from other projects.
2. **Audit of `evals/golden_set.json` (Issue #105, commit `671515b`):**
   - Contains 14 curated test cases across ingested documents (`Khuzaima_Hassan_Resume_1.docx` and `Aspire-Certificate.pdf`) plus 3 out-of-domain negative guardrail queries.
   - Logs observed similarity scores clustering between `0.5810` and `0.8112`, identifying 5 known retrieval gaps where relevant chunks fell below the `0.70` cutoff.
3. **Audit of Existing `evals/` Scripts & Repo Bindings:**
   - [`package.json`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/package.json#L12-L14): Defines `"eval": "npx tsx evals/run_evals.ts"`, `"eval:retrieval": "python evals/eval_retrieval.py"`, and `"eval:generation": "npx tsx evals/eval_generation.ts"`.
   - [`docs/Contributing.md`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/docs/Contributing.md#L121-L123): Documents `evals/` containing `golden_set.json` and `run_evals.py`.
   - [`evals/eval_retrieval.py`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/eval_retrieval.py): Working Python script testing `POST /retrieve` at the 0.70 threshold.
   - [`evals/eval_generation.ts`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/eval_generation.ts): TypeScript LLM-as-judge with ad-hoc boolean schema.
   - [`evals/run_evals.ts`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/run_evals.ts): TypeScript orchestrator that spawns `eval_retrieval.py` and runs `eval_generation.ts`.
   - [`evals/run_evals.py`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/run_evals.py): Python shell wrapper with hardcoded summary printout strings.
4. **Current Metric Baseline:** No RAGAS baseline (Faithfulness, Answer Relevancy, Context Precision, Context Recall) exists yet.

---

## 3. Thesis (Why Build It)

By building a single, unified Python evaluation runner in `evals/run_eval.py` powered by **RAGAS** and Google Gemini, we replace fragmented dual-stack legacy scripts with a reliable, standardized evaluation pipeline.

This enables developers to measure the exact mathematical impact of pipeline changes (e.g. lowering the retrieval threshold to 0.65, changing chunk sizes, or altering system prompt formatting) on answer faithfulness and retrieval recall before deploying.

---

## 4. Hypothesis

> **We believe** that replacing fragmented ad-hoc evaluation scripts with a unified Python RAGAS evaluation runner (`evals/run_eval.py`) evaluating the live pipeline will give engineers reliable, reproducible signal on RAG quality and regressions.
>
> **We will know we are RIGHT if:**
> 1. An engineer can execute `python evals/run_eval.py` against the live backend service and receive dynamic, mathematically computed scores across the 14 golden test cases, exporting timestamped reports to `evals/results/` (Markdown and JSON) in $< 3\text{ minutes}$.
> 2. Initial baseline scores are established and achieve:
>    - **Faithfulness:** $\ge 0.85$ (grounded in context, no hallucinations)
>    - **Answer Relevancy:** $\ge 0.85$ (concise and directly answers the question)
>    - **Context Precision:** $\ge 0.80$ (relevant chunks prioritized)
>    - **Context Recall:** $\ge 0.75$ (retrieves necessary facts for passing cases)
>
> **We will know we are WRONG if:**
> 1. Run-over-run score variance exceeds $15\%$ on identical runs due to judge LLM non-determinism.
> 2. Rate-limiting (429 errors on free-tier Gemini API) causes unhandled crashes during local test execution.

---

## 5. Target User & Jobs to Be Done (JTBD)

### Primary User
- **Quasar AI / Backend Engineer:** Modifying chunking, embedding, similarity thresholds, re-ranking algorithms, or prompt context injection.

### Job to Be Done (JTBD)
- **When** I tune RAG parameters (chunk sizes, overlap, retrieval threshold, RRF k parameter, or context injection prompt),
- **I want to** run a single standardized Python evaluation script against our golden dataset,
- **So I can** review a timestamped report comparing before-and-after scores for faithfulness, precision, recall, and relevancy to ensure zero regressions.

### Non-Users
- End users in the web UI (evaluation is developer tooling and CI infrastructure).

---

## 6. Scope & Deprecation Decisions

### Canonical Single Entry Point: `evals/run_eval.py`
A new, unified Python script [`evals/run_eval.py`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/run_eval.py) will become the **sole canonical entry point** for all RAG evaluation:
1. **Live Retrieval Execution:** Sends HTTP queries to live FastAPI `POST /retrieve` with `INTERNAL_SERVICE_SECRET`.
2. **Live LLM Generation:** Invokes Gemini using the production system prompt and context block format.
3. **Standardized RAGAS Evaluation:** Evaluates each case with RAGAS metrics (`faithfulness`, `answer_relevancy`, `context_precision`, `context_recall`) using Gemini as the judge LLM.
4. **Resilient Rate-Limit Retry:** Exponential backoff wrapper to smoothly handle free-tier API quotas.
5. **Dynamic Reporting & Artifacts:** Outputs a dynamic summary table to terminal and writes timestamped reports (`eval_report_<timestamp>.md` and `eval_report_<timestamp>.json`) to `evals/results/`.

### Deprecation & Deletion Plan
To eliminate confusion and remove dead/overlapping code, the following actions will occur as part of this feature:
- **Files to DELETE once `evals/run_eval.py` is verified:**
  - `evals/run_evals.ts` (legacy TypeScript runner)
  - `evals/run_evals.py` (legacy wrapper with hardcoded printouts)
  - `evals/eval_generation.ts` (superseded TypeScript fact-checker)
  - `evals/eval_retrieval.py` (logic folded into `run_eval.py`)
  - `evals/env.ts` (TypeScript env loader, no longer needed)
- **Files to KEEP:**
  - `evals/golden_set.json` (the 14 test cases)
  - `evals/run_eval.py` (the new canonical runner)
  - `evals/results/` (output directory for reports)
- **Repo Configuration Updates:**
  - Update `package.json` `"eval"` script to run `python evals/run_eval.py` (or `backend/.venv/Scripts/python evals/run_eval.py`).
  - Update `docs/Contributing.md` and `docs/Roadmap.md` to reference `evals/run_eval.py`.

---

## 7. Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Faithfulness Baseline** | $\ge 0.85$ | Average RAGAS faithfulness across golden set |
| **Answer Relevancy Baseline** | $\ge 0.85$ | Average RAGAS answer relevancy across golden set |
| **Context Precision Baseline** | $\ge 0.80$ | Average RAGAS context precision across golden set |
| **Context Recall Baseline** | $\ge 0.75$ | Average RAGAS context recall across golden set |
| **Execution Reliability** | 100% completion without unhandled 429 quota crashes | Exponential backoff retry wrapper |
| **Runtime Performance** | $< 3\text{ minutes}$ | Total execution time for the full 14-case suite |
| **Artifact Generation** | 100% of runs | Timestamped `.md` and `.json` files saved in `evals/results/` |
| **Single Entry Point** | Exactly 1 script (`evals/run_eval.py`) | All legacy runner files deleted from `evals/` |

---

## 8. Non-Goals

1. **No Mocked Pipeline:** Evaluation must execute against live FastAPI `/retrieve` and real Gemini LLM generation.
2. **No Web UI Dashboard in MVP:** Evaluation output will be CLI + Markdown/JSON artifacts in `evals/results/`, not a frontend page in Next.js.
3. **No Automatic Parameter Mutator:** The suite evaluates and reports quality; it does not automatically mutate production database cutoffs.
4. **No Multiple Overlapping Runners:** We will not maintain dual Python and TypeScript runners.

---

## 9. Key Decisions from Alignment

- **Judge Model:** Google Gemini via `google-genai` / `langchain-google-genai` (consistent with backend stack).
- **Pipeline Invocation:** Live HTTP `POST /retrieve` to FastAPI with `INTERNAL_SERVICE_SECRET`.
- **Dataset:** Reuse the existing 14 test cases in [`evals/golden_set.json`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/golden_set.json).
- **Report Destination:** Timestamped Markdown and JSON files in `evals/results/`.
- **Cleanup Strategy:** Delete `eval_retrieval.py`, `run_evals.py`, `run_evals.ts`, `eval_generation.ts`, `env.ts` once `run_eval.py` is tested.

---

## 10. Next Steps

Proceed to **`plan-architecture`** to design the technical architecture (package dependencies in `backend/requirements.txt`, RAGAS Gemini adapter, dataset schema mapping, execution loop, rate-limit backoff, and report formatters).
