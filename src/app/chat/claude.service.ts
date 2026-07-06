import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { ChatStore } from './chat.store';

/** Shape of each Server-Sent Event emitted by the backend proxy. */
interface StreamEvent {
  type: 'text' | 'done' | 'error';
  text?: string;
  message?: string;
}

/**
 * Talks to our backend proxy's streaming /api/chat endpoint and feeds
 * incoming tokens into the ChatStore as they arrive.
 *
 * Uses the native fetch API + ReadableStream directly (not HttpClient)
 * because we need to read a chunked SSE body incrementally.
 */
@Injectable({ providedIn: 'root' })
export class ClaudeService {
  private readonly store = inject(ChatStore);
  private readonly endpoint = `${environment.apiUrl}/api/chat`;

  async sendMessage(userText: string): Promise<void> {
    const trimmed = userText.trim();
    if (!trimmed) return;

    this.store.clearError();
    this.store.addUserMessage(trimmed);

    // Snapshot history *before* adding the streaming placeholder so we
    // don't send an empty assistant turn back to the API.
    const history = this.store
      .messages()
      .map(({ role, content }) => ({ role, content }));

    this.store.setLoading(true);
    this.store.startAssistantMessage();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed with status ${response.status}`);
      }
      if (!response.body) {
        throw new Error('Streaming is not supported by this response.');
      }

      await this.consumeStream(response.body);
    } catch (err) {
      this.store.setError(err instanceof Error ? err.message : 'Failed to reach the server.');
    } finally {
      this.store.finishStreaming();
      this.store.setLoading(false);
    }
  }

  /** Reads an SSE (`data: {...}\n\n`) body chunk by chunk and dispatches each event. */
  private async consumeStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        this.handleEvent(part);
      }
    }
  }

  private handleEvent(rawEvent: string): void {
    const line = rawEvent.trim();
    if (!line.startsWith('data:')) return;

    const jsonText = line.slice('data:'.length).trim();
    if (!jsonText) return;

    let event: StreamEvent;
    try {
      event = JSON.parse(jsonText);
    } catch {
      return;
    }

    switch (event.type) {
      case 'text':
        if (event.text) this.store.appendToLastMessage(event.text);
        break;
      case 'error':
        this.store.setError(event.message ?? 'The assistant returned an error.');
        break;
      case 'done':
        break;
    }
  }
}
