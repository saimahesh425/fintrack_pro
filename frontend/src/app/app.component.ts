// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { RouterModule }       from '@angular/router';
import { WebSocketService }   from './core/websocket/websocket.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-shell">

      <!-- ── Sidebar ── -->
      <nav class="sidebar">
        <div class="sidebar-brand">
          <span class="brand-icon">🏦</span>
          <span class="brand-name">FinTrack</span>
        </div>

        <ul class="nav-list">
          <li>
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📊</span> Dashboard
            </a>
          </li>
          <li>
            <a routerLink="/transactions" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">💳</span> Transactions
            </a>
          </li>
          <li>
            <a routerLink="/ai-query" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">🤖</span> AI Query
            </a>
          </li>
          <li>
            <a routerLink="/reports" routerLinkActive="active" class="nav-item">
              <span class="nav-icon">📄</span> Reports
            </a>
          </li>
        </ul>

        <div class="sidebar-footer">
          <div class="ws-status" [class.connected]="wsConnected">
            <span class="ws-dot">●</span>
            {{ wsConnected ? 'Live' : 'Connecting...' }}
          </div>
        </div>
      </nav>

      <!-- ── Main content ── -->
      <main class="main-content">
        <!-- Compliance alert banner -->
        <div class="alert-banner" *ngFor="let alert of activeAlerts">
          ⚠️ <strong>Compliance Alert:</strong> {{ alert.message }}
          <button class="dismiss-btn" (click)="dismissAlert(alert)">✕</button>
        </div>

        <router-outlet />
      </main>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }

    .app-shell { display: flex; height: 100vh; background: #f5f7fa; }

    /* ── Sidebar ── */
    .sidebar { width: 220px; background: #1a3f6b; color: #fff; display: flex; flex-direction: column; flex-shrink: 0; }
    .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 24px 20px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .brand-icon { font-size: 24px; }
    .brand-name { font-size: 18px; font-weight: 700; letter-spacing: 0.5px; }

    .nav-list { list-style: none; padding: 16px 0; margin: 0; flex: 1; }
    .nav-list li { margin: 2px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; color: rgba(255,255,255,0.8); text-decoration: none; font-size: 14px; transition: all 0.15s; }
    .nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .nav-item.active { background: rgba(255,255,255,0.2); color: #fff; font-weight: 600; }
    .nav-icon { font-size: 16px; width: 20px; text-align: center; }

    .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); }
    .ws-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.6); }
    .ws-status.connected { color: #9fe1cb; }
    .ws-dot { font-size: 10px; }

    /* ── Main ── */
    .main-content { flex: 1; overflow-y: auto; }

    /* ── Alert banner ── */
    .alert-banner { background: #fce8e8; border-bottom: 2px solid #e24b4a; padding: 12px 24px; display: flex; align-items: center; gap: 8px; font-size: 14px; color: #a32d2d; }
    .dismiss-btn { margin-left: auto; background: none; border: none; cursor: pointer; color: #a32d2d; font-size: 16px; }
  `]
})
export class AppComponent implements OnInit {

  wsConnected   = false;
  activeAlerts  : Array<{message: string; id: string}> = [];

  constructor(private wsService: WebSocketService) {}

  ngOnInit() {
    this.wsService.connect();
    this.wsConnected = true;

    // Listen for compliance alerts
    this.wsService.complianceAlerts$.subscribe(alert => {
      this.activeAlerts.push({
        message: `Transaction ${alert.transactionId} flagged — rules: ${(alert.triggeredRules || []).join(', ')}`,
        id: alert.transactionId
      });
      // Auto-dismiss after 10 seconds
      setTimeout(() => this.dismissAlert({ id: alert.transactionId, message: '' }), 10000);
    });
  }

  dismissAlert(alert: {id: string; message: string}) {
    this.activeAlerts = this.activeAlerts.filter(a => a.id !== alert.id);
  }
}
