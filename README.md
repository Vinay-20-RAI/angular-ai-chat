# Angular AI Chat

A streaming chat application built with **Angular 21** (standalone components + Signals, no RxJS in app code) and an **Express** backend that proxies requests to the **Claude Messages API**, streaming tokens to the browser as they're generated.

## Architecture

```
Browser (Angular)  --fetch, SSE-->  Express proxy (backend/proxy.js)  --stream-->  Anthropic Messages API
```

- The Anthropic API key lives **only** in the backend's `.env` file. The frontend never sees it.
- The backend streams Claude's response back to the browser as Server-Sent Events (`data: {...}\n\n`), one event per text delta plus a final `done`/`error` event.
- The frontend reads the response body with `fetch` + `ReadableStream`, parses each SSE frame, and appends tokens to the in-progress assistant message signal in real time.

## Project Structure

```
angular-ai-chat/
├── src/
│   ├── app/
│   │   ├── chat/
│   │   │   ├── chat.store.ts        # Signal store: messages, loading, error
│   │   │   ├── claude.service.ts    # Streams tokens from the backend
│   │   │   └── chat.component.ts    # Chat UI (bubbles, markdown, typing indicator)
│   │   └── app.component.ts
│   ├── main.ts
│   └── styles.css
├── backend/
│   └── proxy.js                     # Express server, proxies to Anthropic API
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 20+
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys))

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure the backend:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `ANTHROPIC_API_KEY` to your key.

3. Run both the backend and the Angular dev server together:

   ```bash
   npm run dev
   ```

   Or run them separately:

   ```bash
   npm run backend   # Express proxy on http://localhost:3000
   npm start         # Angular dev server on http://localhost:4200
   ```

4. Open [http://localhost:4200](http://localhost:4200) and start chatting.

## Configuration

All backend configuration is via environment variables (see `.env.example`):

| Variable               | Default                   | Description                                  |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`    | *(required)*                | Your Anthropic API key                        |
| `ANTHROPIC_MODEL`      | `claude-opus-4-8`           | Claude model used for chat completions        |
| `ANTHROPIC_MAX_TOKENS` | `4096`                      | Max output tokens per response                |
| `PORT`                 | `3000`                      | Port the Express proxy listens on             |
| `CORS_ORIGIN`          | `http://localhost:4200`     | Allowed origin for the Angular dev server     |

The frontend's `apiUrl` is set in `environments/environment.ts` (dev) and `environments/environment.prod.ts` (prod) — point it at your deployed backend URL for production builds.

## Security Notes

- Never commit a real `.env` file — it's excluded via `.gitignore`.
- The `apiKey` field in `environments/*.ts` is always empty by design; it exists only to document that no key belongs there.
- The backend validates the shape of incoming messages and returns structured JSON errors on bad input.

## Building for Production

```bash
npm run build
```

Deploy the Express backend (`backend/proxy.js`) separately, and point `environments/environment.prod.ts`'s `apiUrl` at its public URL before building the frontend.
