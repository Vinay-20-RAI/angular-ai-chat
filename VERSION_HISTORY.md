# Version History

## 1.1.0 — 2026-07-14

Phase 1 (Token Counting) release.

**Backend**
- `backend/proxy.js` — listens for the SDK's raw `streamEvent` alongside the existing `text`/`error` listeners; reads `input_tokens` from `message_start` and `output_tokens` from `message_delta`, attaching `usage: { inputTokens, outputTokens }` to the success-path `done` SSE event (the refusal path is unaffected)

**Frontend**
- `ClaudeService` (`src/app/chat/claude.service.ts`) forwards `event.usage` to `ChatStore.recordUsage()` when the `done` event carries it
- `ChatStore` (`src/app/chat/chat.store.ts`) adds a `usageHistory` signal and computed `cumulativeInputTokens`, `cumulativeOutputTokens`, `estimatedCost`, and `isNearLimit` signals (placeholder $3/$15 per-million-token pricing — update `INPUT_COST_PER_MILLION_TOKENS`/`OUTPUT_COST_PER_MILLION_TOKENS` to match the actual `ANTHROPIC_MODEL` in use)
- `ChatComponent` (`src/app/chat/chat.component.ts`) shows a usage stats line (cumulative input/output tokens, estimated cost) and an amber warning banner once cumulative input tokens exceed 150,000

## 1.0.0 — 2026-07-06

Initial release.

**Frontend**
- Angular 21, standalone components only (no NgModules)
- Signals for all state — no RxJS in application code
- `ChatStore` (`src/app/chat/chat.store.ts`) holds messages/loading/error signals
- `ClaudeService` (`src/app/chat/claude.service.ts`) streams SSE tokens from the backend and appends them to the in-progress assistant message
- `ChatComponent` (`src/app/chat/chat.component.ts`) renders the conversation with `@for`/`@if`, markdown via `marked`, a typing indicator, and responsive chat-bubble styling

**Backend**
- `backend/proxy.js` — Express server exposing `POST /api/chat`
- Streams from the Anthropic Messages API (`@anthropic-ai/sdk`) to the browser as Server-Sent Events
- Reads `ANTHROPIC_API_KEY` from `.env` (never exposed to the client)
- CORS restricted to the configured frontend origin; JSON body validation; centralized error handling
