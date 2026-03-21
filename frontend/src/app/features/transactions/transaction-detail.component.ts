import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { TransactionApiService } from '../../core/api/transaction-api.service';
import { Transaction } from '../../core/store/transaction.model';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="page">
  <div class="back-row">
    <a routerLink="/transactions" class="back-link">&larr; Back to transactions</a>
  </div>

  <div *ngIf="tx; else loading">
    <div class="detail-header">
      <div>
        <h1 class="page-title">Transaction Detail</h1>
        <p class="mono muted">{{ tx.id }}</p>
      </div>
      <span class="badge" [class]="'badge-' + tx.status">{{ tx.status }}</span>
    </div>

    <div class="grid-2">
      <!-- Info card -->
      <div class="card">
        <div class="card-head"><h3>Transaction Info</h3></div>
        <dl class="info-dl">
          <dt>Account ID</dt>       <dd>{{ tx.accountId }}</dd>
          <dt>Counterparty</dt>     <dd>{{ tx.counterpartyId }}</dd>
          <dt>Amount</dt>           <dd class="bold amount">{{ tx.amount | currency:tx.currency }}</dd>
          <dt>Currency</dt>         <dd>{{ tx.currency }}</dd>
          <dt>Created</dt>          <dd>{{ tx.createdAt | date:'medium' }}</dd>
          <dt>Last Updated</dt>     <dd>{{ tx.updatedAt | date:'medium' }}</dd>
        </dl>
      </div>

      <!-- Risk card -->
      <div class="card risk-card">
        <div class="card-head"><h3>Risk Assessment</h3></div>
        <div class="risk-display" [class]="'rd-' + getRisk(tx.riskScore)">
          <div class="risk-big">{{ tx.riskScore || 0 }}</div>
          <div class="risk-lbl">Risk Score</div>
        </div>
        <div class="risk-bar-wrap">
          <div class="risk-bar-track">
            <div class="risk-bar-fill" [style.width.%]="tx.riskScore || 0"
                 [class]="'fill-' + getRisk(tx.riskScore)"></div>
          </div>
          <span class="risk-hint">{{ getRiskLabel(tx.riskScore) }}</span>
        </div>
      </div>
    </div>

    <!-- AI Summary -->
    <div class="card" *ngIf="tx.aiSummary">
      <div class="card-head">
        <h3>AI Analysis</h3>
        <span class="ai-badge">Powered by OpenAI</span>
      </div>
      <div class="ai-body">{{ tx.aiSummary }}</div>
    </div>

    <!-- No AI summary placeholder -->
    <div class="card ai-empty" *ngIf="!tx.aiSummary">
      <div class="card-head"><h3>AI Analysis</h3></div>
      <div class="ai-placeholder">
        <p>No AI analysis available for this transaction yet.</p>
        <p class="muted">Use the <a routerLink="/ai-query">AI Query</a> screen to analyse it.</p>
      </div>
    </div>
  </div>

  <ng-template #loading>
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading transaction...</p>
    </div>
  </ng-template>
</div>
  `,
  styles: [`
    .page       { padding: 24px; max-width: 960px; }
    .back-link  { color: var(--primary); font-size: 13px; font-weight: 500; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
    .back-row   { margin-bottom: 18px; }

    .detail-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-title { font-size: 22px; font-weight: 700; color: var(--primary-dark); }

    .grid-2     { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .card       { background: var(--white); border: 1px solid var(--gray-100); border-radius: var(--radius-lg); margin-bottom: 16px; }
    .card-head  { padding: 16px 20px 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--gray-100); }
    .card-head h3 { font-size: 14px; font-weight: 600; color: var(--primary-dark); margin: 0; }

    .info-dl    { display: grid; grid-template-columns: 130px 1fr; gap: 6px 16px; padding: 16px 20px; margin: 0; }
    dt          { font-size: 12px; color: var(--gray-400); font-weight: 500; align-self: center; }
    dd          { font-size: 13px; color: var(--gray-900); margin: 0; }
    .bold       { font-weight: 700; }
    .amount     { font-size: 18px; color: var(--primary-dark); }

    .risk-card  { display: flex; flex-direction: column; }
    .risk-display { text-align: center; padding: 24px 20px 16px; border-radius: 10px; margin: 16px 20px 0; }
    .rd-low      { background: var(--success-light); }
    .rd-medium   { background: var(--warning-light); }
    .rd-high     { background: var(--danger-light);  }
    .rd-critical { background: var(--danger);        }
    .rd-critical .risk-big, .rd-critical .risk-lbl { color: #fff; }
    .risk-big   { font-size: 52px; font-weight: 800; color: var(--primary-dark); }
    .risk-lbl   { font-size: 12px; font-weight: 500; color: var(--gray-600); margin-top: 2px; }
    .risk-bar-wrap { padding: 12px 20px 20px; }
    .risk-bar-track { height: 8px; background: var(--gray-100); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
    .risk-bar-fill  { height: 100%; border-radius: 4px; transition: width 0.6s; }
    .fill-low      { background: var(--success); }
    .fill-medium   { background: var(--warning); }
    .fill-high     { background: var(--danger); }
    .fill-critical { background: #7A1A1A; }
    .risk-hint  { font-size: 12px; color: var(--gray-400); }

    .ai-badge   { background: var(--purple-light); color: var(--purple); padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .ai-body    { padding: 16px 20px; font-size: 14px; line-height: 1.7; color: var(--gray-900); white-space: pre-wrap; }
    .ai-empty .ai-placeholder { padding: 24px 20px; color: var(--gray-400); font-size: 13px; }
    .ai-placeholder a { color: var(--primary); }

    .loading-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 20px; color: var(--gray-400); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--gray-100); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .mono { font-family: monospace; font-size: 12px; }
    .muted { color: var(--gray-400); font-size: 12px; margin-top: 4px; }
  `]
})
export class TransactionDetailComponent implements OnInit {
  tx: Transaction | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: TransactionApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getById(id).subscribe({
      next: tx => { this.tx = tx; this.cdr.markForCheck(); },
      error: () => {
        // Fallback — show mock data if backend offline
        this.tx = {
          id, accountId: 'ACC-DEMO', counterpartyId: 'CORP-DEMO',
          amount: 15000, currency: 'USD', status: 'FLAGGED',
          riskScore: 85, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.cdr.markForCheck();
      }
    });
  }

  getRisk(score: number): string {
    if (!score) return 'low';
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  getRiskLabel(score: number): string {
    if (!score) return 'No risk score';
    if (score >= 90) return 'Critical — immediate action required';
    if (score >= 70) return 'High risk — review required';
    if (score >= 40) return 'Medium risk — monitor closely';
    return 'Low risk — cleared';
  }
}
