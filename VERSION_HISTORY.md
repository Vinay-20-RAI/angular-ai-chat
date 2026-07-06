# Version History

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
