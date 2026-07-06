/**
 * Development environment configuration.
 *
 * `apiKey` is intentionally always empty — the Anthropic API key lives only
 * in the backend's `.env` file (see .env.example) and is never shipped to
 * the browser. The frontend only ever talks to our own backend proxy.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  apiKey: '',
};
