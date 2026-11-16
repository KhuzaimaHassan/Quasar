# Agent generation recovery verification

Checked on November 6, 2026 (Asia/Karachi).

The repair subsequently merged in [PR #124](https://github.com/KhuzaimaHassan/Quasar/pull/124), commit `40b45c1`. The observations below retain their original environments and timing: the live baseline preceded the patch, and the mocked local graph tests verify recovery. Merge/deployment does not turn that baseline into a live injected-503 recovery test. See [Fix History](Fix-History.md) for later repairs and verification limits.

## Live baseline, before this patch

The existing deployment at `qausar.vercel.app` retained three failed runs with provider HTTP 503. A new small text-file task reached the reviewer, then failed its revision limit over trailing-newline formatting. This showed the provider was responding again; it did not prove that the application recovered from a transient error within a run.

A second task requested one Markdown file, `demo-note.md`, with an Agent demo heading and a short explanation of approval. The live application showed the proposed contents at the approval gate and then reported Run Completed Successfully after approval, listing that file. The target was Generate files only; no GitHub commit was made. This baseline success preceded the recovery patch and must not be attributed to it.

## Local patch validation

From `backend/`:

```bash
python -m unittest discover -s tests -p 'test_agent_*.py' -v
```

Ten tests passed; the existing database concurrency test was skipped because an isolated CI database was not configured locally. The migration-check job runs that test against its PostgreSQL service.

Coverage includes transient 500/502/503/504 recovery, persistent errors stopping after two attempts, no retries for quota/auth/validation/transport errors, preservation of model and response schema, shrinking request timeouts across a shared budget, rejecting late success, safe error references and SDK configuration validation.

The real LangGraph definition is also exercised with an in-memory checkpointer, synthetic model responses and mocked storage/GitHub tools. A first planner 503 recovers; the graph pauses with the expected proposed filename and zero writes. Approving the paused state writes exactly once, without repeating any generation or calling GitHub.

Backend Ruff checks and type checks passed. Local type checking used `--follow-imports=skip` to check all 40 backend source files without re-analyzing the installed cloud SDK dependency tree. The normal CI type-check command remains unchanged.

This patch is intended to recover from a brief provider failure, not to resolve a persistent provider outage. At the time of this local verification, live deployment and end-to-end testing of the patched backend still required review/deployment; the baseline browser test above used the then-existing main deployment. The subsequent merge is recorded at the top of this document without changing the scope of that evidence.
