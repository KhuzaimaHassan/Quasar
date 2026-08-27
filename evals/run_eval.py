import os
import sys
import types

# Create legacy module alias for RAGAS 0.4.3 compatibility with langchain-community 0.4+
if "langchain_community.chat_models.vertexai" not in sys.modules:
    dummy_vertex = types.ModuleType("langchain_community.chat_models.vertexai")
    dummy_vertex.ChatVertexAI = None
    sys.modules["langchain_community.chat_models.vertexai"] = dummy_vertex

import re
import time
import json
import logging
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("evals.run_eval")

# Load environment variables
env_paths = [
    Path(__file__).parent.parent / "backend" / ".env",
    Path(__file__).parent.parent / ".env.local",
    Path(__file__).parent.parent / ".env",
]
for ep in env_paths:
    if ep.exists():
        load_dotenv(dotenv_path=ep)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
INTERNAL_SERVICE_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "dev_internal_secret")
FASTAPI_SERVICE_URL = os.getenv("FASTAPI_SERVICE_URL", "http://127.0.0.1:8000")
RESPONSE_MODEL_NAME = os.getenv("EVAL_RESPONSE_MODEL", "gemini-3.5-flash-lite")
JUDGE_MODEL_NAME = os.getenv("EVAL_JUDGE_MODEL", "gemini-3.5-flash-lite")
EMBEDDING_MODEL_NAME = os.getenv("EVAL_EMBEDDING_MODEL", "models/gemini-embedding-001")

if not GOOGLE_API_KEY:
    logger.error("GOOGLE_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not found in environment.")
    sys.exit(1)

# Import RAGAS and LangChain dependencies
try:
    from ragas.dataset_schema import SingleTurnSample, EvaluationDataset
    from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithReference, LLMContextRecall
    from ragas import evaluate
    from ragas.run_config import RunConfig
    from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings
    from google import genai
except ImportError as e:
    logger.error(f"Required package missing: {e}. Please ensure backend/.venv dependencies are installed.")
    sys.exit(1)

class CleanChatGoogleGenerativeAI(ChatGoogleGenerativeAI):
    """Wrapper that recursively strips markdown code fences from LLM text and structured list responses before RAGAS Pydantic JSON parsing."""
    def _clean_text(self, content: Any) -> Any:
        if isinstance(content, str):
            t = content.strip()
            if t.startswith("```"):
                t = re.sub(r"^```(?:json)?\s*\n", "", t)
                t = re.sub(r"\n\s*```$", "", t)
            return t.strip()
        elif isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and "text" in item:
                    item["text"] = self._clean_text(item["text"])
            return content
        return content

    def generate(self, messages, stop=None, callbacks=None, **kwargs):
        result = super().generate(messages, stop=stop, callbacks=callbacks, **kwargs)
        for gen_list in result.generations:
            for gen in gen_list:
                if hasattr(gen, "message") and hasattr(gen.message, "content"):
                    gen.message.content = self._clean_text(gen.message.content)
                if hasattr(gen, "text"):
                    gen.text = self._clean_text(gen.text)
        return result

    async def agenerate(self, messages, stop=None, callbacks=None, **kwargs):
        result = await super().agenerate(messages, stop=stop, callbacks=callbacks, **kwargs)
        for gen_list in result.generations:
            for gen in gen_list:
                if hasattr(gen, "message") and hasattr(gen.message, "content"):
                    gen.message.content = self._clean_text(gen.message.content)
                if hasattr(gen, "text"):
                    gen.text = self._clean_text(gen.text)
        return result

def retry_with_backoff(func, max_retries: int = 6, initial_delay: float = 4.0):
    """Executes a function with exponential backoff for rate limit (429) and temporary service (503) errors."""
    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            return func()
        except Exception as e:
            err_msg = str(e).lower()
            retryable_keywords = ["429", "503", "500", "502", "504", "quota", "rate", "resource_exhausted", "unavailable", "overloaded"]
            is_retryable = any(k in err_msg for k in retryable_keywords)
            if is_retryable and attempt < max_retries:
                logger.warning(f"[API Transient Error / Rate Limit] Retrying attempt {attempt}/{max_retries} in {delay:.1f}s... Error: {e}")
                time.sleep(delay)
                delay *= 2.0
            else:
                raise

def fetch_retrieved_chunks(workspace_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Calls the live FastAPI /retrieve endpoint."""
    url = f"{FASTAPI_SERVICE_URL.rstrip('/')}/retrieve"
    payload = json.dumps({
        "workspace_id": workspace_id,
        "query": query,
        "top_k": top_k
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": INTERNAL_SERVICE_SECRET
        }
    )

    def _call():
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("chunks", [])

    return retry_with_backoff(_call)

def generate_llm_response(client: genai.Client, query: str, chunks: List[Dict[str, Any]]) -> str:
    """Generates an answer using Gemini with the retrieved context block."""
    if chunks:
        context_parts = []
        for c in chunks:
            filename = c.get("filename", "Unknown Document")
            content = c.get("content", "").strip()
            context_parts.append(f"Source: {filename}\n{content}")
        context_str = "\n\n".join(context_parts)
    else:
        context_str = "No relevant document context found."

    prompt = f"""You are Quasar, an AI assistant. You answer user questions using the provided context documents.

<context>
{context_str}
</context>

User Question: {query}
"""

    def _generate():
        resp = client.models.generate_content(
            model=RESPONSE_MODEL_NAME,
            contents=prompt,
        )
        return resp.text.strip() if resp.text else ""

    return retry_with_backoff(_generate)

def calc_segment_metrics(cases: List[Dict[str, Any]], filter_fn) -> Dict[str, Any]:
    filtered = [c for c in cases if filter_fn(c)]
    if not filtered:
        return {
            "faithfulness": {"score": None, "validCount": 0, "totalCount": 0},
            "answer_relevancy": {"score": None, "validCount": 0, "totalCount": 0},
            "context_precision": {"score": None, "validCount": 0, "totalCount": 0},
            "context_recall": {"score": None, "validCount": 0, "totalCount": 0}
        }

    totals = {"faithfulness": 0.0, "answer_relevancy": 0.0, "context_precision": 0.0, "context_recall": 0.0}
    counts = {"faithfulness": 0, "answer_relevancy": 0, "context_precision": 0, "context_recall": 0}
    total_cases = len(filtered)

    for c in filtered:
        scores = c.get("scores", {})
        for metric in totals:
            val = scores.get(metric)
            if val is not None and not (isinstance(val, float) and (val != val)):  # check not NaN
                totals[metric] += float(val)
                counts[metric] += 1

    res = {}
    for m in totals:
        valid_cnt = counts[m]
        res[m] = {
            "score": round(totals[m] / valid_cnt, 4) if valid_cnt > 0 else None,  # None if 0 valid cases
            "validCount": valid_cnt,
            "totalCount": total_cases
        }
    return res

def is_valid_refusal(response_text: str) -> bool:
    refusal_phrases = [
        "no information", "does not contain", "cannot answer", "unable to answer",
        "don't have any information", "do not have any information", "no relevant context"
    ]
    t = response_text.lower()
    return any(p in t for p in refusal_phrases)

def render_score_str(metric_dict: Dict[str, Any]) -> str:
    score = metric_dict.get("score")
    if score is None:
        return "N/A"
    return f"{score:.4f}"

def get_pass_status(metric_dict: Dict[str, Any], target: float) -> str:
    score = metric_dict.get("score")
    v_cnt = metric_dict.get("validCount", 0)
    t_cnt = metric_dict.get("totalCount", 0)

    if score is None or v_cnt == 0:
        return f"INSUFFICIENT COVERAGE (0/{t_cnt} cases)"
    
    passed = score >= target
    status_icon = "✅ PASS" if passed else "⚠️ BELOW TARGET"

    if v_cnt < t_cnt:
        return f"{status_icon} (PARTIAL: {v_cnt}/{t_cnt} cases)"
    else:
        return f"{status_icon} ({v_cnt}/{t_cnt} cases)"

def main():
    logger.info(f"Starting Quasar RAG Evaluation Suite (RAGAS 0.4.3)...")
    logger.info(f"Response Model: {RESPONSE_MODEL_NAME} | Judge LLM: {JUDGE_MODEL_NAME} | Embeddings: {EMBEDDING_MODEL_NAME}")
    
    # 1. Load golden dataset
    golden_path = Path(__file__).parent / "golden_set.json"
    if not golden_path.exists():
        logger.error(f"Golden dataset not found at {golden_path}")
        sys.exit(1)

    with open(golden_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    logger.info(f"Loaded {len(cases)} evaluation test cases from golden_set.json")

    # 2. Initialize Gemini GenAI client
    genai_client = genai.Client(api_key=GOOGLE_API_KEY)

    samples: List[SingleTurnSample] = []
    case_details: List[Dict[str, Any]] = []

    # 3. Execute retrieval and generation for each test case
    for idx, case in enumerate(cases, 1):
        case_id = case["id"]
        question = case["question"]
        workspace_id = case["workspaceId"]
        expected_facts = case.get("expectedFacts", [])

        logger.info(f"[{idx}/{len(cases)}] Processing case '{case_id}'...")

        chunks = fetch_retrieved_chunks(workspace_id=workspace_id, query=question, top_k=5)
        retrieved_contexts = [c.get("content", "") for c in chunks]

        generated_response = generate_llm_response(genai_client, question, chunks)

        reference = "\n".join(expected_facts) if expected_facts else ""

        sample = SingleTurnSample(
            user_input=question,
            retrieved_contexts=retrieved_contexts if retrieved_contexts else ["No context retrieved."],
            response=generated_response,
            reference=reference if reference else "No ground truth facts."
        )
        samples.append(sample)

        case_details.append({
            "id": case_id,
            "question": question,
            "expectedSourceFile": case.get("expectedSourceFile"),
            "knownRetrievalGap": case.get("knownRetrievalGap", False),
            "observedSimilarity": case.get("observedSimilarity"),
            "retrievedChunksCount": len(chunks),
            "retrievedContexts": retrieved_contexts,
            "generatedResponse": generated_response,
            "reference": reference
        })
        time.sleep(1.0)

    # 4. Construct RAGAS EvaluationDataset
    dataset = EvaluationDataset(samples=samples)

    # 5. Initialize RAGAS Judge Models
    logger.info("Initializing CleanChatGoogleGenerativeAI RAGAS Judge models...")
    eval_llm = CleanChatGoogleGenerativeAI(model=JUDGE_MODEL_NAME, google_api_key=GOOGLE_API_KEY)
    eval_embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL_NAME, google_api_key=GOOGLE_API_KEY)

    selected_metrics = [
        Faithfulness(llm=eval_llm),
        ResponseRelevancy(llm=eval_llm, embeddings=eval_embeddings),
        LLMContextPrecisionWithReference(llm=eval_llm),
        LLMContextRecall(llm=eval_llm)
    ]

    logger.info("Running RAGAS evaluation with RunConfig(max_workers=1, max_wait=180) for 100% zero-drop metric coverage...")

    # Set max_workers=1 for 100% metric coverage under Google GenAI Free Tier 15 RPM limits
    run_config = RunConfig(max_workers=1, max_wait=180)

    def _run_evaluation():
        return evaluate(
            dataset=dataset,
            metrics=selected_metrics,
            llm=eval_llm,
            embeddings=eval_embeddings,
            run_config=run_config
        )

    eval_result = retry_with_backoff(_run_evaluation)

    df = eval_result.to_pandas()

    metric_col_map = {
        "faithfulness": "faithfulness",
        "answer_relevancy": "answer_relevancy",
        "context_precision": "llm_context_precision_with_reference" if "llm_context_precision_with_reference" in df.columns else "context_precision",
        "context_recall": "context_recall"
    }

    for i, detail in enumerate(case_details):
        detail["scores"] = {}
        for key, col_name in metric_col_map.items():
            if col_name in df.columns:
                val = df.iloc[i].get(col_name)
                detail["scores"][key] = round(float(val), 4) if (val is not None and not (isinstance(val, float) and val != val)) else None
            else:
                detail["scores"][key] = None

    overall_metrics = calc_segment_metrics(case_details, lambda c: True)
    in_scope_metrics = calc_segment_metrics(case_details, lambda c: not c["knownRetrievalGap"] and c["expectedSourceFile"] is not None)
    known_gap_metrics = calc_segment_metrics(case_details, lambda c: c["knownRetrievalGap"])
    guardrail_metrics = calc_segment_metrics(case_details, lambda c: c["expectedSourceFile"] is None)

    guardrail_cases = [c for c in case_details if c["expectedSourceFile"] is None]
    refusal_successes = sum(1 for c in guardrail_cases if c["retrievedChunksCount"] == 0 and is_valid_refusal(c["generatedResponse"]))
    guardrail_refusal_rate = round(refusal_successes / len(guardrail_cases), 4) if guardrail_cases else 1.0

    logger.info("Evaluation complete! 3-Way Segmented RAGAS Scores:")
    logger.info(f" - In-Scope Suite (5 cases): Faithfulness={render_score_str(in_scope_metrics['faithfulness'])} ({in_scope_metrics['faithfulness']['validCount']}/5), Relevancy={render_score_str(in_scope_metrics['answer_relevancy'])} ({in_scope_metrics['answer_relevancy']['validCount']}/5), Precision={render_score_str(in_scope_metrics['context_precision'])} ({in_scope_metrics['context_precision']['validCount']}/5), Recall={render_score_str(in_scope_metrics['context_recall'])} ({in_scope_metrics['context_recall']['validCount']}/5)")
    logger.info(f" - Known Retrieval Gap Suite (6 cases): Precision={render_score_str(known_gap_metrics['context_precision'])}, Recall={render_score_str(known_gap_metrics['context_recall'])}")
    logger.info(f" - Negative Guardrail Refusal Suite (3 cases): Refusal Accuracy={guardrail_refusal_rate * 100:.1f}% ({refusal_successes}/3)")

    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_report_path = results_dir / f"eval_report_{timestamp_str}.json"
    md_report_path = results_dir / f"eval_report_{timestamp_str}.md"

    report_payload = {
        "timestamp": timestamp_str,
        "models": {
            "responseGeneration": RESPONSE_MODEL_NAME,
            "judgeLLM": JUDGE_MODEL_NAME,
            "judgeEmbeddings": EMBEDDING_MODEL_NAME
        },
        "totalCases": len(cases),
        "segmentedMetrics": {
            "overall": overall_metrics,
            "inScopeRetrievalSuite": in_scope_metrics,
            "knownRetrievalGapSuite": known_gap_metrics,
            "negativeGuardrailRefusalSuite": {
                "refusalRate": guardrail_refusal_rate,
                "refusalCount": refusal_successes,
                "totalGuardrailCases": len(guardrail_cases),
                "metrics": guardrail_metrics
            }
        },
        "cases": case_details
    }

    with open(json_report_path, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    md_lines = [
        f"# RAG Evaluation Report — {timestamp_str}\n",
        f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ",
        f"**Cases Evaluated:** {len(cases)}  ",
        f"**Response Generation Model:** `{RESPONSE_MODEL_NAME}`  ",
        f"**RAGAS Judge Model:** `{JUDGE_MODEL_NAME}`  ",
        f"**Embedding Model:** `{EMBEDDING_MODEL_NAME}`  \n",
        "## 1. Primary Benchmark: In-Scope Retrieval Suite (5 Cases)",
        "| Metric | Target | Score (Valid Case Average) | Non-NaN Coverage | Status |",
        "| :--- | :---: | :---: | :---: | :---: |",
        f"| **Faithfulness** | $\\ge 0.85$ | `{render_score_str(in_scope_metrics['faithfulness'])}` | `{in_scope_metrics['faithfulness']['validCount']}/5 cases` | {get_pass_status(in_scope_metrics['faithfulness'], 0.85)} |",
        f"| **Answer Relevancy** | $\\ge 0.85$ | `{render_score_str(in_scope_metrics['answer_relevancy'])}` | `{in_scope_metrics['answer_relevancy']['validCount']}/5 cases` | {get_pass_status(in_scope_metrics['answer_relevancy'], 0.85)} |",
        f"| **Context Precision** | $\\ge 0.80$ | `{render_score_str(in_scope_metrics['context_precision'])}` | `{in_scope_metrics['context_precision']['validCount']}/5 cases` | {get_pass_status(in_scope_metrics['context_precision'], 0.80)} |",
        f"| **Context Recall** | $\\ge 0.75$ | `{render_score_str(in_scope_metrics['context_recall'])}` | `{in_scope_metrics['context_recall']['validCount']}/5 cases` | {get_pass_status(in_scope_metrics['context_recall'], 0.75)} |\n",
        "## 2. Sub-Segment Benchmarks\n",
        f"- **Known Retrieval Gap Suite (6 Cases)**: Context Precision = `{render_score_str(known_gap_metrics['context_precision'])}`, Context Recall = `{render_score_str(known_gap_metrics['context_recall'])}` *(Cases where target similarity < 0.70 threshold)*",
        f"  - *Cases included*: `resume_education`, `resume_10pearls`, `resume_teletabib`, `resume_risk_scoring`, `resume_certifications`, `cert_coursework_hours`",
        f"- **Negative Guardrail Refusal Suite (3 Cases)**: Refusal Accuracy = `{guardrail_refusal_rate * 100:.1f}%` ({refusal_successes}/{len(guardrail_cases)} correct refusals)\n",
        "## 3. Overall Unfiltered Aggregate (14 Cases)",
        "| Metric | Flat Score | Non-NaN Coverage |",
        "| :--- | :---: | :---: |",
        f"| **Faithfulness** | `{render_score_str(overall_metrics['faithfulness'])}` | `{overall_metrics['faithfulness']['validCount']}/14 cases` |",
        f"| **Answer Relevancy** | `{render_score_str(overall_metrics['answer_relevancy'])}` | `{overall_metrics['answer_relevancy']['validCount']}/14 cases` |",
        f"| **Context Precision** | `{render_score_str(overall_metrics['context_precision'])}` | `{overall_metrics['context_precision']['validCount']}/14 cases` |",
        f"| **Context Recall** | `{render_score_str(overall_metrics['context_recall'])}` | `{overall_metrics['context_recall']['validCount']}/14 cases` |\n",
        "## 4. Detailed Per-Case Breakdown\n",
        "| Case ID | Retr. Chunks | Faithfulness | Relevancy | Precision | Recall | Suite Category |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :--- |"
    ]

    for detail in case_details:
        cid = detail["id"]
        rc = detail["retrievedChunksCount"]
        s = detail["scores"]
        cat = "In-Scope" if (not detail["knownRetrievalGap"] and detail["expectedSourceFile"]) else ("Known Gap" if detail["knownRetrievalGap"] else "Guardrail")
        f_val = f"`{s['faithfulness']:.4f}`" if s['faithfulness'] is not None else "`N/A`"
        ar_val = f"`{s['answer_relevancy']:.4f}`" if s['answer_relevancy'] is not None else "`N/A`"
        p_val = f"`{s['context_precision']:.4f}`" if s['context_precision'] is not None else "`N/A`"
        r_val = f"`{s['context_recall']:.4f}`" if s['context_recall'] is not None else "`N/A`"
        md_lines.append(
            f"| `{cid}` | {rc} | {f_val} | {ar_val} | {p_val} | {r_val} | {cat} |"
        )

    md_lines.append("\n---\n*Report generated by Quasar canonical RAG evaluation runner (`evals/run_eval.py`).*")

    with open(md_report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    logger.info(f"JSON report exported to: {json_report_path}")
    logger.info(f"Markdown report exported to: {md_report_path}")

    # Print summary table to terminal
    print("\n" + "=" * 80)
    print(f"QUASAR RAG EVALUATION SUMMARY REPORT ({timestamp_str})")
    print(f"Model: {RESPONSE_MODEL_NAME} | Judge: {JUDGE_MODEL_NAME}")
    print("=" * 80)
    print("PRIMARY IN-SCOPE SUITE (5 Cases):")
    print(f" - Faithfulness       : {render_score_str(in_scope_metrics['faithfulness'])} ({in_scope_metrics['faithfulness']['validCount']}/5 cases)")
    print(f" - Answer Relevancy   : {render_score_str(in_scope_metrics['answer_relevancy'])} ({in_scope_metrics['answer_relevancy']['validCount']}/5 cases)")
    print(f" - Context Precision  : {render_score_str(in_scope_metrics['context_precision'])} ({in_scope_metrics['context_precision']['validCount']}/5 cases)")
    print(f" - Context Recall     : {render_score_str(in_scope_metrics['context_recall'])} ({in_scope_metrics['context_recall']['validCount']}/5 cases)")
    print("-" * 80)
    print(f"GUARDRAIL REFUSAL ACCURACY (3 Cases): {guardrail_refusal_rate * 100:.1f}% ({refusal_successes}/3)")
    print("=" * 80)
    print(f"Reports saved to: {results_dir.resolve()}")

if __name__ == "__main__":
    main()
