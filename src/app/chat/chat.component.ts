import { AfterViewChecked, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ChatStore } from './chat.store';
import { ClaudeService } from './claude.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [DecimalPipe, CurrencyPipe],
  template: `
    <div class="chat-shell">
      <header class="chat-header">
        <h1>Claude Chat</h1>
        <p>Streaming responses from Claude</p>
      </header>

      <div class="messages" #messagesEl>
        @if (messages().length === 0) {
          <div class="empty-state">Ask Claude anything to get started.</div>
        }

        @for (message of messages(); track $index) {
          <div class="message-row" [class.user]="message.role === 'user'">
            <div class="bubble" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
              @if (message.content) {
                <div class="markdown" [innerHTML]="renderMarkdown(message.content)"></div>
              }
              @if (message.isStreaming) {
                <span class="typing-indicator" aria-label="Claude is typing">
                  <span></span><span></span><span></span>
                </span>
              }
            </div>
          </div>
        }

        @if (isNearLimit()) {
          <div class="warning-banner" role="alert">
            Approaching the context limit ({{ cumulativeInputTokens() | number }} input tokens
            used) — consider starting a new conversation.
          </div>
        }

        @if (error(); as errorMessage) {
          <div class="error-banner" role="alert">{{ errorMessage }}</div>
        }

        <div #scrollAnchor></div>
      </div>

      <div class="usage-bar">
        <span>{{ cumulativeInputTokens() | number }} in</span>
        <span>{{ cumulativeOutputTokens() | number }} out</span>
        <span>{{ estimatedCost() | currency: 'USD' : 'symbol' : '1.2-4' }} est.</span>
      </div>

      <div class="input-bar">
        <textarea
          #inputEl
          class="input-field"
          rows="1"
          placeholder="Message Claude..."
          [value]="draft()"
          (input)="draft.set(inputEl.value)"
          (keydown)="onKeydown($event)"
          [disabled]="loading()"
        ></textarea>
        <button
          type="button"
          class="send-button"
          (click)="send()"
          [disabled]="loading() || !draft().trim()"
        >
          Send
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
        width: 100%;
      }

      .chat-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: #fafafa;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .chat-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e0e0e0;
        background: #ffffff;
      }

      .chat-header h1 {
        margin: 0;
        font-size: 1.25rem;
        color: #1a73e8;
      }

      .chat-header p {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: #6b7280;
      }

      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .empty-state {
        margin: auto;
        color: #9ca3af;
        font-size: 0.95rem;
      }

      .message-row {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-start;
        animation: slideIn 0.3s ease-out;
      }

      .message-row.user {
        justify-content: flex-end;
      }

      .bubble {
        max-width: 70%;
        line-height: 1.6;
        font-size: 1rem;
        word-wrap: break-word;
      }

      .bubble.user {
        background: #2196f3;
        color: #ffffff;
        border-radius: 12px 12px 4px 12px;
        padding: 0.75rem 1rem;
      }

      .bubble.assistant {
        background: #ffffff;
        color: #333;
        border: 1px solid #e0e0e0;
        border-radius: 12px 12px 12px 4px;
        padding: 1rem;
      }

      .markdown :first-child {
        margin-top: 0;
      }

      .markdown :last-child {
        margin-bottom: 0;
      }

      .markdown h1 {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 1rem 0 0.5rem;
        color: #1a73e8;
      }

      .markdown h2 {
        font-size: 1.25rem;
        font-weight: bold;
        margin: 0.75rem 0 0.4rem;
        color: #1a73e8;
      }

      .markdown h3 {
        font-size: 1.1rem;
        font-weight: bold;
        margin: 0.6rem 0 0.3rem;
        color: #1a73e8;
      }

      .markdown p {
        margin: 0.5rem 0;
      }

      .markdown code {
        background: #f5f5f5;
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: 'SFMono-Regular', 'Courier New', monospace;
        font-size: 0.9rem;
      }

      .markdown pre {
        background: #2d2d2d;
        color: #f8f8f2;
        padding: 1rem;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.5rem 0;
        font-family: 'SFMono-Regular', 'Courier New', monospace;
        font-size: 0.85rem;
      }

      .markdown pre code {
        background: none;
        padding: 0;
        color: inherit;
      }

      .markdown ul,
      .markdown ol {
        margin: 0.5rem 0 0.5rem 1.5rem;
      }

      .markdown li {
        margin: 0.3rem 0;
      }

      .markdown strong {
        font-weight: 600;
        color: #1a73e8;
      }

      .markdown table {
        border-collapse: collapse;
        margin: 0.5rem 0;
        width: 100%;
      }

      .markdown th,
      .markdown td {
        border: 1px solid #ddd;
        padding: 0.5rem;
        text-align: left;
      }

      .markdown th {
        background: #f5f5f5;
        font-weight: 600;
      }

      .markdown hr {
        border: none;
        border-top: 1px solid #ddd;
        margin: 1rem 0;
      }

      .typing-indicator {
        display: inline-flex;
        gap: 4px;
        padding: 0.5rem;
      }

      .typing-indicator span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #999;
        animation: pulse 1.4s infinite;
      }

      .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
      }

      .error-banner {
        background: #ffebee;
        color: #c62828;
        padding: 1rem;
        margin: 0 2rem;
        border-radius: 4px;
        border-left: 4px solid #c62828;
        font-size: 0.9rem;
      }

      .warning-banner {
        background: #fff8e1;
        color: #8a6d00;
        padding: 1rem;
        margin: 0 2rem;
        border-radius: 4px;
        border-left: 4px solid #f9a825;
        font-size: 0.9rem;
      }

      .usage-bar {
        display: flex;
        justify-content: center;
        gap: 1.25rem;
        padding: 0.4rem 1.5rem;
        background: #ffffff;
        border-top: 1px solid #e0e0e0;
        font-size: 0.78rem;
        color: #6b7280;
      }

      .input-bar {
        display: flex;
        gap: 0.75rem;
        padding: 1.5rem;
        border-top: 1px solid #e0e0e0;
        background: #ffffff;
      }

      .input-field {
        flex: 1;
        resize: none;
        border: 1px solid #ddd;
        border-radius: 24px;
        padding: 0.75rem 1rem;
        font-size: 1rem;
        font-family: inherit;
        max-height: 8rem;
        outline: none;
        transition: border-color 0.2s;
      }

      .input-field:focus {
        border-color: #2196f3;
      }

      .input-field:disabled {
        background: #f5f5f5;
        cursor: not-allowed;
      }

      .send-button {
        border: none;
        border-radius: 24px;
        padding: 0.75rem 1.5rem;
        background: #2196f3;
        color: #ffffff;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }

      .send-button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .send-button:not(:disabled):hover {
        background: #1976d2;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes pulse {
        0%,
        60%,
        100% {
          opacity: 0.5;
        }
        30% {
          opacity: 1;
        }
      }

      @media (max-width: 640px) {
        .chat-shell {
          max-width: 100%;
        }

        .bubble {
          max-width: 88%;
        }
      }
    `,
  ],
})
export class ChatComponent implements AfterViewChecked {
  private readonly store = inject(ChatStore);
  private readonly claude = inject(ClaudeService);
  private readonly sanitizer = inject(DomSanitizer);

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  readonly messages = this.store.messages;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly cumulativeInputTokens = this.store.cumulativeInputTokens;
  readonly cumulativeOutputTokens = this.store.cumulativeOutputTokens;
  readonly estimatedCost = this.store.estimatedCost;
  readonly isNearLimit = this.store.isNearLimit;
  readonly draft = signal('');

  ngAfterViewChecked(): void {
    this.scrollAnchor?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  renderMarkdown(content: string): SafeHtml {
    const html = marked.parse(content, { async: false, breaks: true }) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.loading()) return;

    this.draft.set('');
    await this.claude.sendMessage(text);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }
}
