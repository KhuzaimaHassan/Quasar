# Memory

Quasar uses the last 30 messages as short-term conversation context and stores long-term memories in PostgreSQL. Long-term memory belongs to the signed-in **user**, not the active workspace. Project-specific workspace memory remains a roadmap item. See [fix history](Fix-History.md) for repairs and [ADR-024](Decisions.md#adr-024-user-managed-memories-take-precedence-over-extraction) for the protection policy.

## Extraction and retrieval

After a successful chat response, background extraction runs when the submitted history length is divisible by five (`messages.length % 5 === 0`). This counts messages in the request, not every fifth user turn. The extractor receives that submitted history and asks for durable user facts in four categories:

| Scope | Example key/value |
|---|---|
| `preference` | `language: TypeScript` |
| `project` | `stack: Next.js + FastAPI` |
| `style` | `comments: minimal` |
| `fact` | `role: Data Engineer` |

The extractor uses the server's `BACKGROUND_MODEL_ID` and Google key, never the user's BYOK key. Structured output is validated; confidence must be greater than 0.6 and at most 1. Empty keys/values and malformed facts are rejected before persistence. Extraction failure is logged and does not fail the completed chat.

At prompt construction, the API reads up to ten memories for the authenticated user with confidence at least 0.7, ordered by `lastUpdated` descending. An extracted fact between 0.6 and 0.7 can appear in Memory without entering the model prompt.

## Protecting user decisions

| Operation | Result |
|---|---|
| Add manually, including an existing scope/key | Save the user's value, confidence 1, `isUserManaged=true` |
| Change a value inline | Save the correction, confidence 1, `isUserManaged=true` |
| Extract a new fact | Insert with `isUserManaged=false` |
| Extract an existing automatic fact | Update its value, confidence and timestamp |
| Extract an existing protected fact | Leave the entire row unchanged, including its timestamp |

`src/lib/memory-store.ts` owns these writes. Automatic persistence uses one parameterized PostgreSQL `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE "isUserManaged" = false` statement. The predicate is checked under the conflicting row's lock, so an extraction that races a manual add/edit cannot restore the old value after the manual write commits. A separate read followed by an unconditional upsert would not provide this guarantee.

Uniqueness remains `(userId, scope, key)`. The flag does not expand access: API routes require Clerk authentication and check row ownership, and manual updates also include `userId` in their database predicate. Client request schemas do not accept a protection flag or confidence override.

## UI

The Memory page lists all categories, supports manual add, inline edit, individual delete and Clear all. Protected rows show a **Protected** badge. Changes are refreshed through React Query invalidation after successful mutations; the current hooks do not implement optimistic cache writes.

Deleting a row or clearing memory does not erase conversation history. Later extraction can learn a deleted fact again from that history. This release protects saved values; it does not implement permanent forgetting, deleted-key tombstones, or a control to remove protection.

## Migration and deployment

`20261116090000_protect_user_managed_memories` adds `Memory.isUserManaged BOOLEAN NOT NULL DEFAULT true`. Every historical row is protected because old data cannot reliably distinguish manual corrections from extraction. Existing values and confidence scores are preserved; the migration does not promote old low-confidence facts into prompts. All new automatic inserts explicitly use `false`.

Apply the additive migration **before** deploying this application version to any database it uses. Preview deployments may share a production database; a feature branch is not proof of database isolation. Follow [Deployment](Deployment.md#memory-protection-release) and never run the integration suite against an account database.

The old application can read the additive column, but rolling back to old code restores its old unconditional overwrite behavior. Do not treat a code rollback as retaining this protection.

## Verification

`tests/memory-protection.test.ts` covers input boundaries and runs database regressions when an isolated `TEST_DATABASE_URL` or the CI `TEST_DATABASE_*` fields are supplied. It refuses hosted database URLs.

The PostgreSQL tests exercise the actual storage functions: automatic insert/update, protected-row no-op, manual correction and ownership, concurrent manual/automatic first writes and edits, per-user/per-scope isolation, default protection for legacy-shaped inserts, and the real migration against a temporary pre-migration table. CI's migration job runs `npm test` against its PostgreSQL service. Without that service the integration case is explicitly skipped, not counted as a passed database check.

For browser checks, use synthetic rows: add a manual value, edit an automatic value, verify the Protected badge and persistence after reload, then check fields and badges at phone/tablet/desktop widths. A browser test with a mocked local API verifies UI behavior only; it does not prove PostgreSQL concurrency or live cloud deployment.

## Privacy limits

The extraction prompt instructs the model to skip credentials and other sensitive security data; this is a model instruction, not a deterministic secret detector. Users should not submit secrets for memorization. The storage error log records the error type without logging memory values or database parameters.
