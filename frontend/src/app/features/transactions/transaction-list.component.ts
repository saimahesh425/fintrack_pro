// src/app/features/transactions/transaction-list.component.ts
import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule }   from '@angular/common';
import { RouterModule }   from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Store }          from '@ngrx/store';
import { Observable }     from 'rxjs';
import {
  TransactionActions, selectAll, selectLoading, selectTotalElements, selectFilters
} from '../../core/store/transaction.store';
import { Transaction, TransactionFilters } from '../../core/store/transaction.model';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list-container">
      <div class="list-header">
        <h1>Live Transaction Stream</h1>
        <div class="live-indicator">
          <span class="dot"></span> Real-time
        </div>
        <span class="total-count">{{ totalElements$ | async | number }} total</span>
      </div>

      <!-- ── Filters ── -->
      <div class="filters-bar" [formGroup]="filterForm">
        <select formControlName="status" class="filter-select">
          <option value="">All Statuses</option>
          <option value="FLAGGED">Flagged</option>
          <option value="ENRICHING">Enriching</option>
          <option value="CLEARED">Cleared</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="PENDING_AI">Pending AI</option>
        </select>
        <input formControlName="minAmount" type="number" placeholder="Min Amount" class="filter-input" />
        <input formControlName="maxAmount" type="number" placeholder="Max Amount" class="filter-input" />
        <input formControlName="minRiskScore" type="number" placeholder="Min Risk" class="filter-input narrow" min="0" max="100" />
        <input formControlName="accountId" type="text" placeholder="Account ID" class="filter-input" />
        <button class="btn-clear" (click)="clearFilters()">Reset</button>
      </div>

      <!-- ── Loading ── -->
      <div class="loading-row" *ngIf="loading$ | async">
        <span>Loading transactions...</span>
      </div>

      <!-- ── Virtual-scroll transaction table ── -->
      <div class="table-wrap">
        <table class="tx-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Account</th>
              <th>Counterparty</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Risk</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
        </table>
        <cdk-virtual-scroll-viewport itemSize="48" class="virtual-viewport">
          <table class="tx-table-body">
            <tbody>
              <tr *cdkVirtualFor="let tx of transactions$; trackBy: trackById"
                  class="tx-row"
                  [class.flagged]="tx.status === 'FLAGGED'">
                <td class="mono">{{ tx.id | slice:0:8 }}...</td>
                <td>{{ tx.accountId }}</td>
                <td>{{ tx.counterpartyId }}</td>
                <td class="amount">{{ tx.amount | currency:tx.currency }}</td>
                <td>
                  <span class="badge" [class]="'badge-' + tx.status.toLowerCase()">
                    {{ tx.status }}
                  </span>
                </td>
                <td>
                  <div class="risk-bar-wrap">
                    <div class="risk-bar" [style.width.%]="tx.riskScore"
                         [class]="getRiskClass(tx.riskScore)"></div>
                    <span class="risk-num">{{ tx.riskScore }}</span>
                  </div>
                </td>
                <td class="muted">{{ tx.createdAt | date:'dd/MM HH:mm' }}</td>
                <td>
                  <a [routerLink]="['/transactions', tx.id]" class="detail-link">View →</a>
                </td>
              </tr>
            </tbody>
          </table>
        </cdk-virtual-scroll-viewport>
      </div>

    </div>
  `,
  styles: [`
    .list-container { padding: 24px; background: #f5f7fa; min-height: 100vh; }
    .list-header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
    .list-header h1 { font-size: 22px; font-weight: 600; color: #1a3f6b; margin: 0; flex: 1; }
    .live-indicator { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #0f6e56; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #0f6e56; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .total-count { font-size: 13px; color: #888; }

    .filters-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-select, .filter-input {
      padding: 8px 10px; border: 1px solid #c0c8d8; border-radius: 6px;
      font-size: 13px; outline: none;
    }
    .filter-input.narrow { width: 80px; }
    .btn-clear {
      padding: 8px 14px; background: transparent; border: 1px solid #c0c8d8;
      border-radius: 6px; cursor: pointer; color: #666; font-size: 13px;
    }

    .loading-row { padding: 16px; color: #888; font-size: 14px; text-align: center; }

    .table-wrap { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .tx-table { width: 100%; border-collapse: collapse; }
    .tx-table-body { width: 100%; border-collapse: collapse; }
    .tx-table thead th { padding: 12px 14px; background: #f8fafc; color: #555; font-size: 12px; font-weight: 600; text-align: left; border-bottom: 1px solid #e2e8f0; }
    .virtual-viewport { height: 600px; width: 100%; }
    .tx-row td { padding: 12px 14px; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
    .tx-row.flagged { background: #fff8f8; }
    .tx-row:hover { background: #f0f7ff; }

    .badge { padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; }
    .badge-flagged   { background: #fce8e8; color: #a32d2d; }
    .badge-cleared   { background: #e8f5e9; color: #2d5a1b; }
    .badge-enriching { background: #e8f0fe; color: #1f5c99; }
    .badge-pending_ai{ background: #fff8e1; color: #7d4e00; }
    .badge-reviewed  { background: #f0eeff; color: #4a3ba0; }

    .risk-bar-wrap { display: flex; align-items: center; gap: 8px; }
    .risk-bar { height: 6px; border-radius: 3px; min-width: 2px; }
    .risk-low    { background: #9fe1cb; }
    .risk-medium { background: #f9cb42; }
    .risk-high   { background: #e24b4a; }
    .risk-num { font-size: 12px; font-weight: 600; color: #444; }

    .mono { font-family: monospace; color: #555; }
    .amount { font-weight: 600; color: #1a3f6b; }
    .muted { color: #999; font-size: 12px; }
    .detail-link { color: #1f5c99; text-decoration: none; font-size: 12px; font-weight: 500; }
  `]
})
export class TransactionListComponent implements OnInit {

  transactions$ : Observable<Transaction[]> = this.store.select(selectAll);
  loading$       = this.store.select(selectLoading);
  totalElements$ = this.store.select(selectTotalElements);

  filterForm = this.fb.group({
    status:       [''],
    minAmount:    [null],
    maxAmount:    [null],
    minRiskScore: [null],
    accountId:    ['']
  });

  constructor(private store: Store, private fb: FormBuilder) {}

  ngOnInit() {
    this.store.dispatch(TransactionActions.load({ filters: { page: 0, size: 100 } }));

    this.filterForm.valueChanges.subscribe(values => {
      this.store.dispatch(TransactionActions.applyFilters({ filters: values as Partial<TransactionFilters> }));
    });
  }

  clearFilters() {
    this.filterForm.reset({ status: '', minAmount: null, maxAmount: null, minRiskScore: null, accountId: '' });
  }

  trackById = (_: number, tx: Transaction) => tx.id;

  getRiskClass(score: number): string {
    if (score >= 70) return 'risk-high';
    if (score >= 40) return 'risk-medium';
    return 'risk-low';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// transaction-detail.component.ts
// ─────────────────────────────────────────────────────────────────────────────
import { Component, OnInit, ChangeDetectionStrategy as CD } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TransactionApiService } from '../../core/api/transaction-api.service';
import { AsyncPipe, CurrencyPipe, DatePipe, SlicePipe } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: CD.OnPush,
  template: `
    <div class="detail-container" *ngIf="tx$ | async as tx; else loading">

      <div class="detail-header">
        <a routerLink="/transactions" class="back-link">← Back</a>
        <h1>Transaction Detail</h1>
        <span class="badge" [class]="'badge-' + tx.status.toLowerCase()">{{ tx.status }}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-card">
          <h3>Transaction Info</h3>
          <dl class="info-list">
            <dt>ID</dt>             <dd class="mono">{{ tx.id }}</dd>
            <dt>Amount</dt>         <dd class="amount">{{ tx.amount | currency:tx.currency }}</dd>
            <dt>Account ID</dt>     <dd>{{ tx.accountId }}</dd>
            <dt>Counterparty</dt>   <dd>{{ tx.counterpartyId }}</dd>
            <dt>Created</dt>        <dd>{{ tx.createdAt | date:'medium' }}</dd>
            <dt>Updated</dt>        <dd>{{ tx.updatedAt | date:'medium' }}</dd>
          </dl>
        </div>

        <div class="detail-card risk-card">
          <h3>Risk Assessment</h3>
          <div class="risk-score-display" [class]="getRiskClass(tx.riskScore)">
            <div class="risk-big">{{ tx.riskScore || 0 }}</div>
            <div class="risk-label">Risk Score</div>
          </div>
          <div class="risk-bar-full">
            <div class="risk-fill" [style.width.%]="tx.riskScore"
                 [class]="getRiskClass(tx.riskScore)"></div>
          </div>
        </div>

        <div class="detail-card ai-card" *ngIf="tx.aiSummary">
          <h3>AI Analysis</h3>
          <p class="ai-summary">{{ tx.aiSummary }}</p>
        </div>
      </div>

    </div>
    <ng-template #loading>
      <div class="loading-state">Loading transaction...</div>
    </ng-template>
  `,
  styles: [`
    .detail-container { padding: 24px; max-width: 1000px; margin: 0 auto; }
    .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .detail-header h1 { flex: 1; font-size: 22px; font-weight: 600; color: #1a3f6b; margin: 0; }
    .back-link { color: #1f5c99; text-decoration: none; font-size: 14px; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .detail-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; }
    .detail-card h3 { font-size: 14px; font-weight: 600; color: #1a3f6b; margin: 0 0 16px; }
    .ai-card { grid-column: 1 / -1; }

    .info-list { display: grid; grid-template-columns: 130px 1fr; gap: 8px 16px; margin: 0; }
    dt { font-size: 12px; color: #888; font-weight: 500; }
    dd { font-size: 13px; color: #222; margin: 0; }
    .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
    .amount { font-weight: 700; font-size: 16px; color: #1a3f6b; }

    .risk-score-display { text-align: center; padding: 20px; border-radius: 10px; margin-bottom: 12px; }
    .risk-big { font-size: 48px; font-weight: 800; }
    .risk-label { font-size: 13px; margin-top: 4px; }
    .risk-bar-full { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; }
    .risk-fill { height: 100%; border-radius: 4px; transition: width 0.5s; }
    .risk-low    { background: #e8f5e9; color: #2d5a1b; }
    .risk-medium { background: #fff8e1; color: #7d4e00; }
    .risk-high   { background: #fce8e8; color: #a32d2d; }
    .risk-critical { background: #a32d2d; color: #fff; }

    .ai-summary { font-size: 14px; line-height: 1.7; color: #333; margin: 0; white-space: pre-wrap; }
    .badge { padding: 4px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; }
    .badge-flagged { background: #fce8e8; color: #a32d2d; }
    .badge-cleared { background: #e8f5e9; color: #2d5a1b; }
    .loading-state { padding: 60px; text-align: center; color: #888; }
  `]
})
export class TransactionDetailComponent implements OnInit {
  tx$ = new BehaviorSubject<Transaction | null>(null);

  constructor(private route: ActivatedRoute, private api: TransactionApiService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getById(id).subscribe(tx => this.tx$.next(tx));
  }

  getRiskClass(score: number): string {
    if (!score) return 'risk-low';
    if (score >= 90) return 'risk-critical';
    if (score >= 70) return 'risk-high';
    if (score >= 40) return 'risk-medium';
    return 'risk-low';
  }
}
