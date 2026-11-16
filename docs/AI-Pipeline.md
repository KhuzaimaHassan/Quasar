# AI pipeline

Quasar's Next.js chat route authenticates the account, checks conversation ownership and quota, assembles context, streams model output and persists the result. Agent execution is separate; see [Agents.md](Agents.md).

## Models and defaults

| Model | Access and purpose |
|---|---|
| `gemini-4-hydrogen` | New-chat default on this review branch; Google documents API free-tier access. Actual configured-project verification is recorded in [fix history](Fix-History.md). |
| `gemini-3.5-flash-lite` | Retained chat option and background model for memory extraction and titles. |
| `gemini-3.8-flash` | Retained optional server-key chat model; availability and provider quotas can vary. |
| `gemini-2.5-pro` | Google BYOK option; scheduled provider routing/deprecation changes should be reviewed separately. |
| `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` | Anthropic BYOK options. |
| `gpt-4o` | OpenAI BYOK option. |

Models are stored per conversation. Selecting a new-chat default does not rewrite existing conversations. Legacy aliases `gemini-1.5-flash`, `gemini-3.5-flash` and `gemini-3.6-flash` keep resolving to Flash-Lite; they do not silently upgrade to Hydrogen. `DEFAULT_MODEL_ID` and `BACKGROUND_MODEL_ID` are deliberately independent. Premium options still require an encrypted user key, checked on the server as well as in the picker. There is no automatic model fallback or replay of a failed generation.

Google documents Hydrogen's free API input/output and its GenerateContent support. This does not mean all Google features are free: Google Search grounding is unavailable on the API Free tier. Actual quota and model access depend on the configured Google project. See [Google's Hydrogen migration guide](https://aistudio.google.com/docs/whats-new-gemini-4-hydrogen) and [pricing](https://aistudio.google.com/docs/pricing#gemini-4-hydrogen).

## Request and context

`src/app/api/chat/route.ts` accepts validated UI messages and obtains the model from the owned conversation, not an arbitrary request model. It persists the user turn before generation. An explicit retry may reuse only the latest owned matching user message.

The context contains:

1. A system instruction with the current UTC date and the lack of live web search.
2. Up to ten user-wide memories with confidence at least 0.7, ordered by update time.
3. Retrieved document chunks for the conversation's workspace, when available.
4. The request's conversation messages converted to model-message format, capped to the last 30 entries.

There is no implementation of a per-slot token budget or automatic context-overflow retry. The system instruction asks for complete sections, and requires current-events limitations instead of presenting recalled facts as verified latest news. Supplying today's date does not give a model live knowledge. Uploaded sources support their contents, not their continued currency.

Images sent as chat attachments are model inputs. PDF/DOCX chat attachments remain downloadable files; indexed document question answering uses Documents. See [RAG](RAG.md), [API](API.md) and [Memory](Memory.md).

## Streaming and completion status

The application uses `streamText`, `DefaultChatTransport` and `useChat` from the installed Vercel AI SDK. Provider retries are disabled. Google chat requests use low thinking effort. The generation signal is bounded to 45 seconds; the Next.js route maximum is 90 seconds. Chat does not impose a new small output-token cap. These bounds do not guarantee every long answer can finish in one request.

`src/lib/chat-completion.ts` records one terminal outcome per request:

| Outcome | Saved behavior |
|---|---|
| `stop` | Completed assistant text and reported token usage. |
| `length` | Partial text with an output-limit notice. |
| `content-filter` | Partial text with a safety-filter notice; no dedicated Continue action. |
| Error, user stop, timeout | Preserve already received text with an incomplete notice; retain a retryable user-message error if no text arrived. |
| Other/unconfirmed finish | Preserve text with an explicit unconfirmed-completion notice. |

Saved assistant metadata includes `modelId`, `citations`, `completion` (`status`, `finishReason`, safe message) and `tokenUsageAvailable`. The response, conversation token increment and clearing of the corresponding user error commit in one transaction. Overlapping end/error/abort callbacks share a local settlement. In addition, model callbacks and the authenticated Stop endpoint compete under a database lock on the owned user message, keyed by a server-generated generation ID. Only an active generation may create its assistant row and increment tokens; later callbacks cannot overwrite a stopped answer or create a duplicate. No memory extraction is scheduled from an incomplete response.

A provider can report a normal stop for a semantically unfinished answer. This is not reliably detectable from a finish code. Historical replies have no completion metadata and are not retroactively labeled complete or incomplete. The exact cutoff cause of the originally reported answer is unknown.

## Stop persistence

A real serverless preview test showed that aborting browser fetch alone could leave only the question saved: cancellation did not reliably reach the worker's abort callback. The client therefore reads the server-generated `X-Generation-Id` response header and sends its visible partial text to `POST /api/conversations/:id/stop` **before** closing the local stream. The endpoint verifies account/conversation/generation ownership and bounds the text. It shares the same transactional generation claim as model completion. If completion won first, Stop preserves that completed answer; if Stop won, later callbacks are ignored. Citations and model identity come from the server's stored generation context, not the Stop payload.

The generation context is stored in existing user-message JSON metadata (`id`, `state`, `modelId`, `citations`); no migration is needed. States are `active`, `settled` and `failed`. A stop with no text marks the user turn failed/retryable without creating an empty assistant row. After reload, an active pending turn keeps a Stop control available. Retry cannot supersede an active or already settled generation. Stop has its own durable 60/minute account quota so exhausting ordinary chat quota does not immediately prevent stopping.

Stopping finalizes the saved response and closes its client stream; it does not guarantee immediate cancellation of provider computation in another serverless invocation. That worker remains bounded by its generation deadline. If Stop cannot be saved, the client displays a recovery error and leaves the stream running rather than discarding visible text. Before response headers or any text arrive, early local cancellation remains best effort; a subsequently saved pending turn can be stopped explicitly after refresh.

## Continue and retry

The latest saved assistant reply offers **Continue response**, including historical replies whose completion status is unknown. For a safety-filter outcome the dedicated continuation control is omitted. Continue is an explicit new user turn, preserves the original reply and asks the model to resume without repetition. It does not retry automatically, edit old text, replay tools or bypass provider filtering.

The client fetches saved history, confirms the same assistant reply is still latest, restores it into the SDK, and submits one continuation. A synchronous lock and in-flight state prevent repeated clicks while it is running. A changed conversation produces a visible message instead of continuing an older reply. After submission the client explicitly reconciles saved history, including when a quota failure left only an optimistic turn; failed refreshes retain the already loaded answer and show a recovery message. Continuations consume ordinary chat quota and can also fail or reach limits.

**Try again** is the existing recovery path for an orphaned user turn that received no saved assistant text. Error messages remain safe and readable after reopening the chat.

## Usage and observability

When reported, `usage.totalTokens` is saved and added to the conversation total. The displayed number is total usage, not an output-token limit. If an error/abort supplies no final usage, a zero placeholder avoids inventing a count, `tokenUsageAvailable=false` is recorded and the reply says usage is unavailable. Totals can therefore undercount interrupted provider work; they are not billing records.

LangSmith tracing is optional and degrades gracefully. The current wrapper records sanitized request metadata and startup outcome/latency; it does not provide complete stream-finish diagnosis or a full prompt/token trace. Completion status is recorded separately on the saved assistant message. Do not assume old trace-success metadata proves a complete answer.

## Verification and release

`tests/chat-completion.test.ts` exercises real SDK callbacks with synthetic provider streams for normal stop, output limit, content filtering, partial-stream error, user stop and timeout. It also checks single settlement, empty-failure recovery, safe metadata display and current-events instructions. The generation-store suite uses isolated PostgreSQL to test Stop versus late completion races, ownership, repeated stops, retained citations, empty-stop retry, active/settled retry rejection and transaction rollback. Other suites cover model validation, BYOK restrictions, history conversion, attachments, citations and protected memory writes.

Local mocked/fixture results, authenticated preview checks and production results must be reported separately in [Fix-History.md](Fix-History.md). A provider's free-tier documentation or a successful build does not by itself establish live access for this deployment.
