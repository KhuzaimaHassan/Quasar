# PRD: Production RAG Evaluation Suite with RAGAS (Milestone 6)

**Status:** Ready for Review  
**Owner:** Engineering / AI Platform  
**Target Milestone:** M6 (Production Quality & Validation)  
**Spec Target:** `evals/` (architecture & spec to be finalized in `plan-architecture`)

---

## 1. Problem Statement

Quasar currently operates an end-to-end RAG pipeline (document parsing → chunking → Gemini embedding → pgvector cosine retrieval → BM25 RRF re-ranking → context injection → streaming generation).

While a custom test harness exists in `evals/` (`eval_retrieval.py` in Python and `eval_generation.ts` in TypeScript) to check retrieval thresholds and binary fact inclusion, the project lacks **standardized, industry-standard RAG quality metrics**. Specifically:
1. **Ad-hoc vs Standardized Scoring:** The existing generation eval uses a custom prompt with binary boolean checks rather than validated continuous metrics for **Faithfulness** (context grounding without hallucination), **Answer Relevancy** (direct alignment to user query), **Context Precision** (ranking quality of retrieved chunks), and **Context Recall** (coverage of ground-truth reference facts).
2. **Split-Stack Friction:** Retrieval eval is in Python while generation eval is in TypeScript (`tsx`), requiring dual runtimes and limiting interoperability with Python evaluation libraries.
3. **No Automated Threshold Impact Analysis:** Developers cannot easily quantify how adjusting chunk sizes (e.g. 500 tokens), overlap windows (60 tokens), similarity thresholds (currently 0.70), or reranker parameters impacts end-to-end retrieval and generation quality scores in a single report.

---

## 2. Evidence & Existing Infrastructure State

1. **Verified Existing Infrastructure:**
   - **Golden Dataset ([`evals/golden_set.json`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/golden_set.json)):** Contains 14 curated test cases across ingested documents (`Khuzaima_Hassan_Resume_1.docx` and `Aspire-Certificate.pdf`) plus 3 negative guardrail queries.
   - **Retrieval Test ([`evals/eval_retrieval.py`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/eval_retrieval.py)):** Actively queries `POST /retrieve` on the FastAPI backend with internal secret auth, tracking 9 strict passes (6 hits + 3 guardrail rejections) and 5 known sub-0.70 threshold gaps.
   - **Generation Test ([`evals/eval_generation.ts`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/eval_generation.ts)):** Implements a custom LLM-as-judge in TypeScript via `@ai-sdk/google` checking fact presence and source citation.
2. **Documented Similarity Distribution:** As recorded in [`docs/Lessons-Learned.md`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/docs/Lessons-Learned.md) (Issue #88) and `evals/golden_set.json` (Issue #105), `gemini-embedding-001` cosine similarity scores cluster between `0.58` and `0.81`. Five queries currently score `0.58–0.69`, falling below the default 0.70 threshold.
3. **Missing Baseline:** Standardized RAGAS benchmark scores (Faithfulness, Relevancy, Precision, Recall) have not yet been established.

---

## 3. Thesis (Why Build It)

By building a unified Python evaluation runner in `evals/` powered by **RAGAS** and Google Gemini, we extend the existing golden dataset and live FastAPI retrieval harness into an objective, continuous evaluation suite. 

This enables developers to measure the exact mathematical impact of pipeline changes (e.g. lowering the retrieval threshold to 0.65, changing chunk sizes, or altering system prompt formatting) on answer faithfulness and retrieval recall before deploying.

---

## 4. Hypothesis

> **We believe** that extending our evaluation harness with standardized Python RAGAS metrics (Faithfulness, Answer Relevancy, Context Precision, Context Recall) evaluated against the live pipeline will give engineers immediate, objective signal on whether RAG pipeline modifications improve or degrade quality.
>
> **We will know we are RIGHT if:**
> 1. An engineer can run a single local CLI command (e.g. `evals/run_eval.py` or `python -m evals.run_eval`) against the live backend service that evaluates the 14-case golden set and exports a timestamped report to `evals/results/` (Markdown and JSON) in $< 3\text{ minutes}$.
> 2. Initial baseline scores are established and achieve:
>    - **Faithfulness:** $\ge 0.85$ (grounded in context, no hallucinations)
>    - **Answer Relevancy:** $\ge 0.85$ (concise and directly answers the question)
>    - **Context Precision:** $\ge 0.80$ (relevant chunks prioritized)
>    - **Context Recall:** $\ge 0.75$ (retrieves necessary facts for passing cases)
>
> **We will know we are WRONG if:**
> 1. Run-over-run score variance exceeds $15\%$ on identical runs due to judge LLM non-determinism.
> 2. Rate-limiting (429 errors on free-tier Gemini API) makes the evaluation suite unstable without exponential backoff retry.

---

## 5. Target User & Jobs to Be Done (JTBD)

### Primary User
- **Quasar AI / Backend Engineer:** Modifying chunking, embedding, similarity thresholds, re-ranking algorithms, or prompt context injection.

### Job to Be Done (JTBD)
- **When** I tune RAG parameters (chunk sizes, overlap, retrieval threshold, RRF k parameter, or context injection prompt),
- **I want to** run a standardized Python RAGAS evaluation script against our golden dataset,
- **So I can** review a timestamped report comparing before-and-after scores for faithfulness, precision, recall, and relevancy to ensure zero regressions.

### Non-Users
- End users in the web UI (evaluation is developer tooling and CI infrastructure).

---

## 6. Scope: Extending the Existing Harness

This feature is **extending and standardizing the existing working harness** in `evals/`:

### What We Are Keeping & Extending
1. **Golden Dataset ([`evals/golden_set.json`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/golden_set.json)):** Reuse the 14 curated test cases as-is (including questions, workspace IDs, expected source files, and expected ground-truth facts).
2. **Live HTTP Pipeline Invocation:** Follow the proven pattern from `eval_retrieval.py` of querying the live FastAPI `/retrieve` endpoint with `INTERNAL_SERVICE_SECRET` to evaluate real pgvector search + real BM25 RRF re-ranking.

### What We Are Adding / Upgrading
1. **Pure Python Evaluation Runner (`evals/run_eval.py`):** Unify retrieval + generation + evaluation into a single Python workflow, eliminating the split-stack dependency on `eval_generation.ts` and `npx tsx`.
2. **RAGAS Integration:**
   - Integrate `ragas` with Gemini (`google-genai` / `langchain-google-genai`) as the evaluation judge and embedding provider.
   - Compute the four core metrics: `faithfulness`, `answer_relevancy`, `context_precision`, and `context_recall`.
3. **Robust Rate-Limit Handling:** Exponential backoff retry handler to ensure clean execution against Gemini free-tier rate limits.
4. **Structured Output & Artifacts:**
   - Formatted CLI table showing per-test-case scores and aggregate averages.
   - Automatic export of timestamped evaluation reports to `evals/results/eval_report_<timestamp>.md` and `evals/results/eval_report_<timestamp>.json`.

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

---

## 8. Non-Goals

1. **No Mocked Data:** Evaluation must run against live FastAPI `/retrieve` and real Gemini LLM generation.
2. **No Web UI Dashboard in MVP:** Evaluation output will be CLI + Markdown/JSON artifacts in `evals/results/`, not a frontend page in Next.js.
3. **No Automatic Parameter Mutator:** The suite evaluates and reports quality; it does not automatically mutate production database cutoffs.
4. **No Live Chat Interception:** This is offline evaluation / regression testing, not inline telemetry on user messages.

---

## 9. Key Decisions from Alignment

- **Judge Model:** Google Gemini via `google-genai` / `langchain-google-genai` (consistent with backend stack).
- **Pipeline Invocation:** Live HTTP `POST /retrieve` to FastAPI with `INTERNAL_SERVICE_SECRET`, matching `eval_retrieval.py`.
- **Dataset:** Reuse the existing 14 test cases in [`evals/golden_set.json`](file:///c:/Users/Administrator/OneDrive/Desktop/Quasar/evals/golden_set.json).
- **Report Destination:** Timestamped Markdown and JSON files in `evals/results/`.

---

## 10. Next Steps

Proceed to **`plan-architecture`** to design the engineering specification (package dependencies, RAGAS Gemini wrapper, dataset adaptation, evaluation execution loop, error/rate-limit handling, and report generation).
