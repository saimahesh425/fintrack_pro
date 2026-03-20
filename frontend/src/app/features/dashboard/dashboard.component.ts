// src/app/features/dashboard/dashboard.component.ts
import {
  Component, OnInit, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule }    from '@angular/common';
import { RouterModule }    from '@angular/router';
import { Store }           from '@ngrx/store';
import { Observable }      from 'rxjs';
import {
  TransactionActions,
  selectSummary, selectFlaggedTransactions, selectHighRiskTransactions, selectAll
} from '../../core/store/transaction.store';
import { DashboardSummary, Transaction } from '../../core/store/transaction.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard">

      <!-- ── Header ── -->
      <div class="dashboard-header">
        <h1>FinTrack Compliance Dashboard</h1>
        <span class="live-badge">● LIVE</span>
      </div>

      <!-- ── KPI Tiles ── -->
      <div class="kpi-grid" *ngIf="summary$ | async as summary">
        <div class="kpi-card total">
          <div class="kpi-value">{{ summary.totalTransactions | number }}</div>
          <div class="kpi-label">Total Transactions</div>
        </div>
        <div class="kpi-card flagged">
          <div class="kpi-value">{{ summary.flaggedTransactions | number }}</div>
          <div class="kpi-label">Flagged</div>
        </div>
        <div class="kpi-card high-risk">
          <div class="kpi-value">{{ summary.highRiskTransactions | number }}</div>
          <div class="kpi-label">High Risk</div>
        </div>
        <div class="kpi-card cleared">
          <div class="kpi-value">{{ (all$ | async)?.length || 0 }}</div>
          <div class="kpi-label">Loaded in View</div>
        </div>
      </div>

      <!-- ── Recent Flagged Transactions ── -->
      <div class="section">
        <h2>Recent Flagged Transactions</h2>
        <div class="tx-table-wrapper">
          <table class="tx-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Risk</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let tx of flagged$ | async; trackBy: trackById"
                  [routerLink]="['/transactions', tx.id]"
                  class="tx-row clickable">
                <td class="mono">{{ tx.id | slice:0:8 }}...</td>
                <td>{{ tx.accountId }}</td>
                <td class="amount">{{ tx.amount | currency:tx.currency }}</td>
                <td><span class="badge" [class]="'badge-' + tx.status.toLowerCase()">{{ tx.status }}</span></td>
                <td>
                  <span class="risk-badge" [class]="getRiskClass(tx.riskScore)">
                    {{ tx.riskScore }}
                  </span>
                </td>
                <td class="muted">{{ tx.createdAt | date:'HH:mm:ss' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="empty-state" *ngIf="(flagged$ | async)?.length === 0">
            No flagged transactions
          </div>
        </div>
      </div>

      <!-- ── High Risk Transactions ── -->
      <div class="section">
        <h2>High Risk (Score ≥ 70)</h2>
        <div class="risk-list">
          <div *ngFor="let tx of highRisk$ | async; trackBy: trackById"
               class="risk-item"
               [routerLink]="['/transactions', tx.id]">
            <div class="risk-score-circle" [class]="getRiskClass(tx.riskScore)">
              {{ tx.riskScore }}
            </div>
            <div class="risk-detail">
              <div class="risk-id">{{ tx.id | slice:0:12 }}...</div>
              <div class="risk-amount">{{ tx.amount | currency:tx.currency }}</div>
            </div>
            <div class="risk-account">{{ tx.accountId }}</div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard { padding: 24px; background: #f5f7fa; min-height: 100vh; }
    .dashboard-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .dashboard-header h1 { font-size: 24px; font-weight: 600; color: #1a3f6b; margin: 0; }
    .live-badge { background: #0f6e56; color: #fff; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }

    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .kpi-card { background: #fff; border-radius: 12px; padding: 24px 20px; border: 1px solid #e2e8f0; }
    .kpi-card.flagged { border-left: 4px solid #e24b4a; }
    .kpi-card.high-risk { border-left: 4px solid #ba7517; }
    .kpi-card.total { border-left: 4px solid #1f5c99; }
    .kpi-card.cleared { border-left: 4px solid #0f6e56; }
    .kpi-value { font-size: 32px; font-weight: 700; color: #1a3f6b; }
    .kpi-label { font-size: 13px; color: #666; margin-top: 4px; }

    .section { background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
    .section h2 { font-size: 16px; font-weight: 600; color: #1a3f6b; margin: 0 0 16px; }

    .tx-table-wrapper { overflow-x: auto; }
    .tx-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tx-table th { text-align: left; padding: 10px 12px; background: #f8fafc; color: #666; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    .tx-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    .tx-row.clickable { cursor: pointer; transition: background 0.15s; }
    .tx-row.clickable:hover { background: #f0f7ff; }

    .badge { padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-flagged { background: #fce8e8; color: #a32d2d; }
    .badge-cleared { background: #e8f5e9; color: #2d5a1b; }
    .badge-enriching { background: #e8f0fe; color: #1f5c99; }
    .badge-pending_ai { background: #fff8e1; color: #7d4e00; }
    .badge-reviewed { background: #f0eeff; color: #4a3ba0; }

    .risk-badge { padding: 3px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; }
    .risk-low { background: #e8f5e9; color: #2d5a1b; }
    .risk-medium { background: #fff8e1; color: #7d4e00; }
    .risk-high { background: #fce8e8; color: #a32d2d; }
    .risk-critical { background: #a32d2d; color: #fff; }

    .risk-list { display: flex; flex-direction: column; gap: 10px; }
    .risk-item { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; cursor: pointer; transition: background 0.15s; }
    .risk-item:hover { background: #f0f7ff; }
    .risk-score-circle { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .risk-detail { flex: 1; }
    .risk-id { font-family: monospace; font-size: 12px; color: #444; }
    .risk-amount { font-size: 14px; font-weight: 600; color: #1a3f6b; }
    .risk-account { color: #666; font-size: 13px; }

    .mono { font-family: monospace; }
    .amount { font-weight: 600; color: #1a3f6b; }
    .muted { color: #888; font-size: 12px; }
    .empty-state { text-align: center; padding: 40px; color: #888; }
  `]
})
export class DashboardComponent implements OnInit {

  summary$  : Observable<any>           = this.store.select(selectSummary);
  flagged$  : Observable<Transaction[]> = this.store.select(selectFlaggedTransactions);
  highRisk$ : Observable<Transaction[]> = this.store.select(selectHighRiskTransactions);
  all$      : Observable<Transaction[]> = this.store.select(selectAll);

  constructor(private store: Store) {}

  ngOnInit() {
    this.store.dispatch(TransactionActions.loadSummary());
    this.store.dispatch(TransactionActions.load({
      filters: { page: 0, size: 50 }
    }));
  }

  trackById = (_: number, tx: Transaction) => tx.id;

  getRiskClass(score: number): string {
    if (score >= 90) return 'risk-critical';
    if (score >= 70) return 'risk-high';
    if (score >= 40) return 'risk-medium';
    return 'risk-low';
  }
}
