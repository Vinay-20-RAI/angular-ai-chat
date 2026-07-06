import { AfterViewChecked, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ChatStore } from './chat.store';
import { ClaudeService } from './claude.service';

@Component({
  selector: 'app-chat',
  standalone: true,
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

        @if (error(); as errorMessage) {
          <div class="error-banner" role="alert">{{ errorMessage }}</div>
        }

        <div #scrollAnchor></div>
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
      }

      .chat-shell {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-width: 760px;
        margin: 0 auto;
        background: #ffffff;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.06);
      }

      .chat-header {
        padding: 1rem 1.5rem;
        border-bottom: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .chat-header h1 {
        margin: 0;
        font-size: 1.25rem;
        color: #1e3a8a;
      }

      .chat-header p {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
        color: #6b7280;
      }

      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        background: #f9fafb;
      }

      .empty-state {
        margin: auto;
        color: #9ca3af;
        font-size: 0.95rem;
      }

      .message-row {
        display: flex;
        justify-content: flex-start;
        animation: fade-in 0.25s ease-out;
      }

      .message-row.user {
        justify-content: flex-end;
      }

      .bubble {
        max-width: 78%;
        padding: 0.65rem 0.95rem;
        border-radius: 1rem;
        line-height: 1.45;
        font-size: 0.95rem;
        word-wrap: break-word;
      }

      .bubble.user {
        background: #2563eb;
        color: #ffffff;
        border-bottom-right-radius: 0.25rem;
      }

      .bubble.assistant {
        background: #ffffff;
        color: #1a1a1a;
        border: 1px solid #e5e7eb;
        border-bottom-left-radius: 0.25rem;
      }

      .markdown :first-child {
        margin-top: 0;
      }

      .markdown :last-child {
        margin-bottom: 0;
      }

      .markdown pre {
        background: #f3f4f6;
        padding: 0.6rem;
        border-radius: 0.5rem;
        overflow-x: auto;
      }

      .markdown code {
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 0.85em;
      }

      .typing-indicator {
        display: inline-flex;
        gap: 0.2rem;
        padding: 0.15rem 0;
      }

      .typing-indicator span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #9ca3af;
        animation: bounce 1.2s infinite ease-in-out;
      }

      .typing-indicator span:nth-child(2) {
        animation-delay: 0.15s;
      }

      .typing-indicator span:nth-child(3) {
        animation-delay: 0.3s;
      }

      .error-banner {
        align-self: center;
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fecaca;
        padding: 0.5rem 0.9rem;
        border-radius: 0.5rem;
        font-size: 0.85rem;
      }

      .input-bar {
        display: flex;
        gap: 0.6rem;
        padding: 0.85rem 1.25rem;
        border-top: 1px solid #e5e7eb;
        background: #ffffff;
      }

      .input-field {
        flex: 1;
        resize: none;
        border: 1px solid #d1d5db;
        border-radius: 0.75rem;
        padding: 0.6rem 0.85rem;
        font-size: 0.95rem;
        font-family: inherit;
        max-height: 8rem;
      }

      .input-field:focus {
        outline: none;
        border-color: #2563eb;
      }

      .send-button {
        border: none;
        border-radius: 0.75rem;
        padding: 0 1.25rem;
        background: #2563eb;
        color: #ffffff;
        font-weight: 600;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }

      .send-button:disabled {
        background: #93c5fd;
        cursor: not-allowed;
      }

      .send-button:not(:disabled):hover {
        background: #1d4ed8;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
          transform: translateY(4px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes bounce {
        0%,
        60%,
        100% {
          transform: translateY(0);
          opacity: 0.5;
        }
        30% {
          transform: translateY(-4px);
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
