import { Injectable, signal } from '@angular/core';

/**
 * A single message in the conversation.
 * `isStreaming` is true while an assistant message is still receiving tokens.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

/**
 * Signal-based store for chat state: messages, loading, and error.
 * No RxJS — all state is exposed as readonly signals and mutated through
 * the methods below.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

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
