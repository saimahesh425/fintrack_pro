// src/app/features/ai-query/ai-query.component.ts
import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule }     from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Store }            from '@ngrx/store';
import { Subject }          from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil } from 'rxjs/operators';
import { TransactionActions, selectAiResponse, selectAiLoading } from '../../core/store/transaction.store';

@Component({
  selector: 'app-ai-query',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-container">

      <div class="ai-header">
        <div class="ai-icon">🤖</div>
        <div>
          <h2>AI Compliance Query</h2>
          <p>Ask questions about transactions in plain English</p>
        </div>
      </div>

      <!-- ── Query Input ── -->
      <div class="query-box">
        <input
          [formControl]="queryControl"
          placeholder="e.g. Show me high-risk trades above $10,000 flagged today"
          class="query-input"
          [disabled]="(aiLoading$ | async) ?? false"
        />
        <button
          class="query-btn"
          (click)="submitQuery()"
          [disabled]="(aiLoading$ | async) ?? false || !queryControl.value">
          {{ (aiLoading$ | async) ? 'Thinking...' : 'Ask AI' }}
        </button>
        <button class="clear-btn" (click)="clearResponse()">Clear</button>
      </div>

      <!-- ── Suggested queries ── -->
      <div class="suggestions">
        <span class="suggestion-label">Try:</span>
        <button
          *ngFor="let s of suggestions"
          class="suggestion-chip"
          (click)="useSuggestion(s)">
          {{ s }}
        </button>
      </div>

      <!-- ── Loading indicator ── -->
      <div class="loading-bar" *ngIf="aiLoading$ | async">
        <div class="loading-pulse"></div>
        <span>AI is analysing transactions...</span>
      </div>

      <!-- ── AI Response ── -->
      <div class="response-box" *ngIf="(aiResponse$ | async) as response">
        <div class="response-header">
          <span>AI Analysis</span>
          <button class="copy-btn" (click)="copyResponse(response)">Copy</button>
        </div>
        <pre class="response-text">{{ response }}<span class="cursor" *ngIf="aiLoading$ | async">▋</span></pre>
      </div>

    </div>
  `,
  styles: [`
    .ai-container { padding: 24px; max-width: 900px; margin: 0 auto; }
    .ai-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .ai-icon { font-size: 40px; }
    .ai-header h2 { margin: 0; font-size: 20px; font-weight: 600; color: #1a3f6b; }
    .ai-header p { margin: 4px 0 0; color: #666; font-size: 14px; }

    .query-box { display: flex; gap: 8px; margin-bottom: 12px; }
    .query-input { flex: 1; padding: 12px 16px; border: 2px solid #c0c8d8; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .query-input:focus { border-color: #1f5c99; }
    .query-btn { padding: 12px 20px; background: #1f5c99; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
    .query-btn:hover:not(:disabled) { background: #1a3f6b; }
    .query-btn:disabled { background: #aaa; cursor: not-allowed; }
    .clear-btn { padding: 12px 16px; background: transparent; border: 1px solid #c0c8d8; border-radius: 8px; cursor: pointer; color: #666; }

    .suggestions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
    .suggestion-label { font-size: 12px; color: #888; }
    .suggestion-chip { padding: 5px 12px; background: #f0f7ff; border: 1px solid #c0d4f0; border-radius: 16px; font-size: 12px; cursor: pointer; color: #1f5c99; transition: background 0.15s; }
    .suggestion-chip:hover { background: #d5e8f0; }

    .loading-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #f0f7ff; border-radius: 8px; margin-bottom: 16px; color: #1f5c99; font-size: 13px; }
    .loading-pulse { width: 8px; height: 8px; border-radius: 50%; background: #1f5c99; animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

    .response-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .response-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #444; }
    .copy-btn { padding: 4px 10px; background: transparent; border: 1px solid #c0c8d8; border-radius: 4px; cursor: pointer; font-size: 11px; color: #666; }
    .response-text { margin: 0; padding: 20px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-wrap: break-word; color: #1a1a1a; font-family: inherit; }
    .cursor { animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  `]
})
export class AIQueryComponent implements OnInit, OnDestroy {

  queryControl = new FormControl('');
  aiResponse$  = this.store.select(selectAiResponse);
  aiLoading$   = this.store.select(selectAiLoading);

  private destroy$    = new Subject<void>();
  private eventSource : EventSource | null = null;

  suggestions = [
    'Show flagged transactions above $10,000',
    'Find high-risk trades from today',
    'List transactions with AML threshold breach',
    'Show structuring suspected transactions'
  ];

  constructor(private store: Store, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Auto-submit on Enter key
    this.queryControl.valueChanges.pipe(
      debounceTime(600),
      distinctUntilChanged(),
      filter(v => !!v && v.length > 8),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  submitQuery() {
    const q = this.queryControl.value?.trim();
    if (!q) return;
    this.closeEventSource();
    this.store.dispatch(TransactionActions.aiQuery({ query: q }));
    this.streamAiResponse(q);
  }

  private streamAiResponse(query: string) {
    const url = `/api/ai/query?q=${encodeURIComponent(query)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('token', (event: MessageEvent) => {
      this.store.dispatch(TransactionActions.aiToken({ token: event.data }));
    });

    this.eventSource.addEventListener('done', () => {
      this.store.dispatch(TransactionActions.aiComplete());
      this.closeEventSource();
    });

    this.eventSource.onerror = (err) => {
      console.error('SSE error', err);
      this.store.dispatch(TransactionActions.aiError({ error: 'Connection failed' }));
      this.closeEventSource();
    };
  }

  private closeEventSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  useSuggestion(text: string) {
    this.queryControl.setValue(text);
    this.submitQuery();
  }

  clearResponse() {
    this.queryControl.setValue('');
    this.closeEventSource();
    this.store.dispatch(TransactionActions.aiClear());
  }

  copyResponse(text: string) {
    navigator.clipboard.writeText(text);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.closeEventSource();
  }
}
