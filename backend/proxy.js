// Express proxy that streams Claude Messages API responses to the Angular
// frontend as Server-Sent Events. The Anthropic API key never leaves this
// process — the browser only ever talks to this server.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
const MAX_TOKENS = Number(process.env.ANTHROPIC_MAX_TOKENS) || 4096;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:4200';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'Missing ANTHROPIC_API_KEY. Copy .env.example to .env and set your Anthropic API key.',
  );
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

/** Validates the shape of the messages array sent by the frontend. */
function isValidMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.length > 0,
    )
  );
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body ?? {};

  if (!isValidMessages(messages)) {
    return res.status(400).json({
      error: 'Request body must include a non-empty "messages" array of { role, content } items.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
    });

    stream.on('text', (textDelta) => {
      send({ type: 'text', text: textDelta });
    });

    stream.on('error', (streamErr) => {
      console.error('Anthropic stream error:', streamErr);
      send({ type: 'error', message: streamErr.message || 'Streaming error occurred.' });
    });

    const finalMessage = await stream.finalMessage();

    // A refusal returns HTTP 200 with stop_reason "refusal" rather than
    // throwing — surface it to the client as an error state.
    if (finalMessage.stop_reason === 'refusal') {
      send({ type: 'error', message: 'Claude declined to respond to this request.' });
    } else {
      send({ type: 'done' });
    }
  } catch (err) {
    console.error('Claude API error:', err);
    send({ type: 'error', message: err?.message || 'Failed to reach the Claude API.' });
  } finally {
    res.end();
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', model: MODEL });
});

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// Centralized error handler — keeps stack traces out of client responses.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Claude proxy server listening on http://localhost:${PORT}`);
  console.log(`Using model: ${MODEL}`);
});
