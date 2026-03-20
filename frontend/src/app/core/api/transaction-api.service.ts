// src/app/core/api/transaction-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DashboardSummary, PagedResponse, Transaction, TransactionFilters
} from '../store/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionApiService {

  private readonly base = '/api/transactions';

  constructor(private http: HttpClient) {}

  search(filters: TransactionFilters): Observable<PagedResponse<Transaction>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('size', filters.size);

    if (filters.accountId)    params = params.set('accountId',    filters.accountId);
    if (filters.status)       params = params.set('status',       filters.status);
    if (filters.minAmount)    params = params.set('minAmount',    filters.minAmount);
    if (filters.maxAmount)    params = params.set('maxAmount',    filters.maxAmount);
    if (filters.minRiskScore) params = params.set('minRiskScore', filters.minRiskScore);
    if (filters.from)         params = params.set('from',         filters.from);
    if (filters.to)           params = params.set('to',           filters.to);

    return this.http.get<PagedResponse<Transaction>>(this.base, { params });
  }

  getById(id: string): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.base}/${id}`);
  }

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.base}/summary`);
  }

  create(tx: Partial<Transaction>, idempotencyKey: string): Observable<Transaction> {
    return this.http.post<Transaction>(this.base, tx, {
      headers: { 'Idempotency-Key': idempotencyKey }
    });
  }
}
