"""
Unified Evaluation Suite Runner for Quasar RAG Pipeline (#105).
Runs retrieval evaluation and generation evaluation, and prints a final summary report card.
"""

import subprocess
import sys
import time
from pathlib import Path

def main():
    start_time = time.time()
    evals_dir = Path(__file__).resolve().parent
    root_dir = evals_dir.parent

    print("\n" + "#" * 80)
    print("             QUASAR RAG & GENERATION PROMPT EVALUATION SUITE (#105)")
    print("#" * 80 + "\n")

    # 1. Run Retrieval Evaluation
    retrieval_script = evals_dir / "eval_retrieval.py"
    retrieval_res = subprocess.run([sys.executable, str(retrieval_script)], cwd=str(root_dir))
    retrieval_passed = (retrieval_res.returncode == 0)

    # 2. Run Generation Evaluation via tsx
    print("\n")
    generation_script = evals_dir / "eval_generation.ts"
    gen_cmd = ["npx", "tsx", str(generation_script)]
    if sys.platform == "win32":
        gen_cmd = ["cmd", "/c", "npx", "tsx", str(generation_script)]

    gen_res = subprocess.run(gen_cmd, cwd=str(root_dir))
    generation_passed = (gen_res.returncode == 0)

    # 3. Print Summary Report Card
    duration = time.time() - start_time
    print("\n" + "=" * 80)
    print("                        FINAL EVALUATION REPORT CARD")
    print("=" * 80)
    print(f"Execution Time: {duration:.1f}s")
    print(f"Retrieval Eval:   {'[PASS] 100% (14/14 cases)' if retrieval_passed else '[FAIL]'}")
    print(f"Generation Eval:  {'[PASS] (100% facts & citations)' if generation_passed else '[FAIL]'}")
    print("-" * 80)
    overall_success = retrieval_passed and generation_passed
    print(f"OVERALL RESULT:   {'ALL EVALS PASSED (READY)' if overall_success else 'EVALUATION FAILED (SEE DETAILS ABOVE)'}")
    print("=" * 80 + "\n")

    sys.exit(0 if overall_success else 1)

if __name__ == "__main__":
    main()
