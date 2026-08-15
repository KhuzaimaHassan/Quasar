"""
Retrieval Evaluation Script for Quasar RAG Pipeline.
Directly queries FastAPI /retrieve with internal service secret auth.
Evaluates:
- Relevant queries: correct source document retrieved with similarity scores.
- Disambiguation queries: correct source document retrieved over other documents.
- Irrelevant queries: negative guardrail (0 chunks retrieved / below threshold).
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Any, List, Optional

def load_env():
    """Load environment variables from .env.local or .env if not present."""
    root_dir = Path(__file__).resolve().parent.parent
    for env_file in [root_dir / ".env.local", root_dir / ".env"]:
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("\"'")
                        if k not in os.environ:
                            os.environ[k] = v

def run_retrieval_eval(golden_path: Optional[str] = None) -> Dict[str, Any]:
    load_env()
    
    if golden_path is None:
        golden_path = str(Path(__file__).resolve().parent / "golden_set.json")
        
    with open(golden_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    fastapi_url = os.environ.get("FASTAPI_SERVICE_URL", "http://127.0.0.1:8000").rstrip("/")
    internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET", "dev_internal_secret")

    results = []
    passed_count = 0
    failed_count = 0

    print("=" * 80)
    print("QUASAR RETRIEVAL EVALUATION (FastAPI /retrieve)")
    print(f"Target Service: {fastapi_url}")
    print(f"Total Test Cases: {len(cases)}")
    print("=" * 80)

    for i, case in enumerate(cases, 1):
        case_id = case.get("id", f"case_{i}")
        question = case["question"]
        workspace_id = case["workspaceId"]
        expected_file = case.get("expectedSourceFile")
        
        req_data = json.dumps({
            "workspace_id": workspace_id,
            "query": question,
            "top_k": 5
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{fastapi_url}/retrieve",
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": internal_secret
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                chunks = resp_data.get("chunks", [])
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            chunks = []
            print(f"[{case_id}] HTTP Error {e.code}: {err_msg}")
        except Exception as e:
            chunks = []
            print(f"[{case_id}] Request Error: {e}")

        # Evaluate outcome
        retrieved_files = [c.get("filename") for c in chunks if c.get("filename")]
        similarities = [c.get("similarity", 0.0) for c in chunks]

        passed = False
        details = ""

        if expected_file is None:
            # Irrelevant question -> Should return 0 chunks (below similarity threshold)
            if len(chunks) == 0:
                passed = True
                details = "Correctly rejected (0 chunks above similarity threshold)"
            else:
                passed = False
                top_scores = [f"{c.get('filename')}: {c.get('similarity', 0.0):.3f}" for c in chunks]
                details = f"False positive: retrieved {len(chunks)} chunk(s) unexpectedly: {', '.join(top_scores)}"
        else:
            # Relevant question -> Should find expectedSourceFile in chunks
            if expected_file in retrieved_files:
                # Find matching chunk similarity
                matching_chunks = [c for c in chunks if c.get("filename") == expected_file]
                max_sim = max((c.get("similarity", 0.0) for c in matching_chunks), default=0.0)
                passed = True
                details = f"Found '{expected_file}' (top similarity: {max_sim:.4f}, total chunks: {len(chunks)})"
            else:
                passed = False
                if len(chunks) == 0:
                    details = f"Failed to retrieve expected file '{expected_file}' (0 chunks returned)"
                else:
                    details = f"Failed: expected '{expected_file}', but retrieved: {list(set(retrieved_files))}"

        if passed:
            passed_count += 1
            status_str = "\033[92mPASS\033[0m"
        else:
            failed_count += 1
            status_str = "\033[91mFAIL\033[0m"

        results.append({
            "id": case_id,
            "question": question,
            "expectedSourceFile": expected_file,
            "retrievedFiles": retrieved_files,
            "similarities": similarities,
            "passed": passed,
            "details": details
        })

        print(f"\n[{i}/{len(cases)}] {case_id} => {status_str}")
        print(f"  Q: \"{question}\"")
        print(f"  Expected: {expected_file or 'None (Irrelevant / 0 chunks)'}")
        print(f"  Result:   {details}")
        if chunks:
            print("  Retrieved Chunks:")
            for idx, c in enumerate(chunks, 1):
                sim = c.get("similarity", 0.0)
                fn = c.get("filename", "unknown")
                preview = c.get("content", "").replace("\n", " ")[:90]
                print(f"    {idx}. [{fn}] (sim: {sim:.4f}) \"{preview}...\"")

    print("\n" + "=" * 80)
    print(f"RETRIEVAL EVAL SUMMARY: {passed_count}/{len(cases)} Passed ({passed_count/len(cases)*100:.1f}%)")
    print("=" * 80)

    return {
        "total": len(cases),
        "passed": passed_count,
        "failed": failed_count,
        "results": results
    }

if __name__ == "__main__":
    eval_res = run_retrieval_eval()
    if eval_res["failed"] > 0:
        sys.exit(1)
    sys.exit(0)
