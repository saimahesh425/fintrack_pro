// src/app/core/store/transaction.model.ts
export interface Transaction {
  id:             string;
  accountId:      string;
  counterpartyId: string;
  amount:         number;
  currency:       string;
  status:         TransactionStatus;
  riskScore:      number;
  aiSummary?:     string;
  createdAt:      string;
  updatedAt:      string;
}

export type TransactionStatus =
  | 'INGESTED' | 'VALIDATING' | 'ENRICHING'
  | 'PENDING_AI' | 'FLAGGED' | 'CLEARED' | 'REVIEWED';

export interface DashboardSummary {
  totalTransactions:    number;
  flaggedTransactions:  number;
  highRiskTransactions: number;
}

export interface TransactionFilters {
  accountId?:    string;
  status?:       TransactionStatus | '';
  minAmount?:    number;
  maxAmount?:    number;
  minRiskScore?: number;
  from?:         string;
  to?:           string;
  page:          number;
  size:          number;
}

export interface PagedResponse<T> {
  content:       T[];
  totalElements: number;
  totalPages:    number;
  number:        number;
  size:          number;
}
