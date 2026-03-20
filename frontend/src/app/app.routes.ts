// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./features/transactions/transaction-list.component').then(m => m.TransactionListComponent)
  },
  {
    path: 'transactions/:id',
    loadComponent: () =>
      import('./features/transactions/transaction-detail.component').then(m => m.TransactionDetailComponent)
  },
  {
    path: 'ai-query',
    loadComponent: () =>
      import('./features/ai-query/ai-query.component').then(m => m.AIQueryComponent)
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./features/reports/reports.component').then(m => m.ReportsComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
