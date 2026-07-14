import { Injectable, computed, signal } from '@angular/core';

/**
 * A single message in the conversation.
 * `isStreaming` is true while an assistant message is still receiving tokens.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

/** Token usage reported for a single assistant response. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Placeholder per-million-token rates — update these to match the actual
// pricing of the MODEL configured in backend/proxy.js.
const INPUT_COST_PER_MILLION_TOKENS = 3;
const OUTPUT_COST_PER_MILLION_TOKENS = 15;

// Above this many cumulative input tokens, warn the user they're
// approaching the model's context window limit.
const NEAR_LIMIT_INPUT_TOKENS = 150_000;

/**
 * Signal-based store for chat state: messages, loading, error, and token usage.
 * No RxJS — all state is exposed as readonly signals and mutated through
 * the methods below.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _usageHistory = signal<TokenUsage[]>([]);

  readonly messages = this._messages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly cumulativeInputTokens = computed(() =>
    this._usageHistory().reduce((sum, usage) => sum + usage.inputTokens, 0),
  );

  readonly cumulativeOutputTokens = computed(() =>
    this._usageHistory().reduce((sum, usage) => sum + usage.outputTokens, 0),
  );

  readonly estimatedCost = computed(() => {
    const inputCost = (this.cumulativeInputTokens() / 1_000_000) * INPUT_COST_PER_MILLION_TOKENS;
    const outputCost =
      (this.cumulativeOutputTokens() / 1_000_000) * OUTPUT_COST_PER_MILLION_TOKENS;
    return inputCost + outputCost;
  });

  readonly isNearLimit = computed(() => this.cumulativeInputTokens() > NEAR_LIMIT_INPUT_TOKENS);

  addUserMessage(content: string): void {
    this._messages.update((msgs) => [...msgs, { role: 'user', content }]);
  }

  /** Appends a new, empty assistant message that will be filled in as tokens stream in. */
  startAssistantMessage(): void {
    this._messages.update((msgs) => [
      ...msgs,
      { role: 'assistant', content: '', isStreaming: true },
    ]);
  }

  /** Appends a chunk of text to the last (streaming) message. */
  appendToLastMessage(chunk: string): void {
    this._messages.update((msgs) => {
      if (msgs.length === 0) return msgs;
      const next = [...msgs];
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, content: last.content + chunk };
      return next;
    });
  }

  /** Marks the last message as no longer streaming. */
  finishStreaming(): void {
    this._messages.update((msgs) => {
      if (msgs.length === 0) return msgs;
      const next = [...msgs];
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, isStreaming: false };
      return next;
    });
  }

  /** Appends the token usage reported for one assistant response. */
  recordUsage(usage: TokenUsage): void {
    this._usageHistory.update((history) => [...history, usage]);
  }

  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  setError(message: string | null): void {
    this._error.set(message);
  }

  clearError(): void {
    this._error.set(null);
  }
}
