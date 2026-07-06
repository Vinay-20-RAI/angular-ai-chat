# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-07-06

### Added

- Initial release: Angular 21 standalone chat UI with Signals-based state management
- `ChatStore` — signal store for messages, loading, and error state
- `ClaudeService` — streams tokens from the backend via `fetch` + `ReadableStream`
- `ChatComponent` — chat bubble UI with markdown rendering, typing indicator, and animations
- Express backend (`backend/proxy.js`) that proxies requests to the Anthropic Messages API with SSE streaming
- Environment-based configuration with no API keys in frontend code
