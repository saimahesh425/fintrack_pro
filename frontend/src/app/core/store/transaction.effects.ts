// src/app/core/store/transaction.effects.ts
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, from, fromEvent } from 'rxjs';
import {
  catchError, debounceTime, map,
  switchMap, withLatestFrom
} from 'rxjs/operators';
import { TransactionActions } from './transaction.store';
import { TransactionApiService } from '../api/transaction-api.service';
import { selectFilters } from './transaction.store';

@Injectable()
export class TransactionEffects {

  private actions$  = inject(Actions);
  private store     = inject(Store);
  private api       = inject(TransactionApiService);

  // ── Load transactions on filter change ────────────────────────────────
  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.load),
      switchMap(({ filters }) =>
        this.api.search(filters).pipe(
          map(response => TransactionActions.loadSuccess({ response })),
          catchError(err  => from([TransactionActions.loadFailure({ error: err.message })]))
        )
      )
    )
  );

  // ── Auto-reload when filters change ───────────────────────────────────
  reloadOnFilter$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.applyFilters),
      debounceTime(300),
      withLatestFrom(this.store.select(selectFilters)),
      map(([, filters]) => TransactionActions.load({ filters }))
    )
  );

  // ── Load dashboard summary ─────────────────────────────────────────────
  loadSummary$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TransactionActions.loadSummary),
      switchMap(() =>
        this.api.getSummary().pipe(
          map(summary => TransactionActions.summarySuccess({ summary })),
          catchError(() => EMPTY)
        )
      )
    )
  );
}
