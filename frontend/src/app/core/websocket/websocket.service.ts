// src/app/core/websocket/websocket.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { TransactionActions } from '../store/transaction.store';
import { Transaction } from '../store/transaction.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {

  private client!: Client;
  private destroy$ = new Subject<void>();
  private reconnectDelay = 1000;

  complianceAlerts$ = new Subject<any>();
  auditEvents$      = new Subject<any>();

  constructor(private store: Store) {}

  connect(): void {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: this.reconnectDelay,

      onConnect: () => {
        console.log('[WS] Connected to FinTrack WebSocket');
        this.reconnectDelay = 1000; // Reset backoff on successful connect

        // ── Subscribe to transaction updates ───────────────────────────
        this.client.subscribe('/topic/transactions', (msg: IMessage) => {
          try {
            const transaction: Transaction = JSON.parse(msg.body);
            this.store.dispatch(TransactionActions.wsUpdate({ transaction }));
          } catch (e) {
            console.error('[WS] Failed to parse transaction event', e);
          }
        });

        // ── Subscribe to compliance alerts ─────────────────────────────
        this.client.subscribe('/topic/compliance-alerts', (msg: IMessage) => {
          try {
            const alert = JSON.parse(msg.body);
            this.complianceAlerts$.next(alert);
            console.warn('[WS] Compliance alert received:', alert);
          } catch (e) {
            console.error('[WS] Failed to parse compliance alert', e);
          }
        });

        // ── Subscribe to audit events ──────────────────────────────────
        this.client.subscribe('/topic/audit', (msg: IMessage) => {
          try {
            const event = JSON.parse(msg.body);
            this.auditEvents$.next(event);
          } catch (e) {
            console.error('[WS] Failed to parse audit event', e);
          }
        });
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers['message']);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Exponential backoff cap 30s
      },

      onDisconnect: () => {
        console.warn('[WS] Disconnected from FinTrack WebSocket');
      }
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.client?.active) {
      this.client.deactivate();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
