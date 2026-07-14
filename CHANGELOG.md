# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-07-14

### Added

- Token usage tracking (Phase 1): cumulative input/output token counts, an estimated cost, and a near-context-limit warning banner
- Backend captures `input_tokens` / `output_tokens` from the raw Anthropic stream events (`message_start` / `message_delta`) and reports them on the SSE `done` event
- `ChatStore.recordUsage()` plus computed `cumulativeInputTokens`, `cumulativeOutputTokens`, `estimatedCost`, and `isNearLimit` signals
- Usage stats line and an amber "approaching context limit" banner in the chat UI

## [1.0.0] - 2026-07-06

### Added

- Initial release: Angular 21 standalone chat UI with Signals-based state management
- `ChatStore` — signal store for messages, loading, and error state
- `ClaudeService` — streams tokens from the backend via `fetch` + `ReadableStream`
- `ChatComponent` — chat bubble UI with markdown rendering, typing indicator, and animations
- Express backend (`backend/proxy.js`) that proxies requests to the Anthropic Messages API with SSE streaming
- Environment-based configuration with no API keys in frontend code
