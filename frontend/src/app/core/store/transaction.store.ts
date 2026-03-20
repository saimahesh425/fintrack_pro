// ─────────────────────────────────────────────────────────────────────────
// transaction.actions.ts
// ─────────────────────────────────────────────────────────────────────────
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Transaction, TransactionFilters, DashboardSummary, PagedResponse } from './transaction.model';

export const TransactionActions = createActionGroup({
  source: 'Transactions',
  events: {
    'Load':             props<{ filters: TransactionFilters }>(),
    'Load Success':     props<{ response: PagedResponse<Transaction> }>(),
    'Load Failure':     props<{ error: string }>(),
    'WS Update':        props<{ transaction: Transaction }>(),
    'Select':           props<{ id: string }>(),
    'Apply Filters':    props<{ filters: Partial<TransactionFilters> }>(),
    'Load Summary':     emptyProps(),
    'Summary Success':  props<{ summary: DashboardSummary }>(),
    'AI Query':         props<{ query: string }>(),
    'AI Token':         props<{ token: string }>(),
    'AI Complete':      emptyProps(),
    'AI Error':         props<{ error: string }>(),
    'AI Clear':         emptyProps(),
  }
});

// ─────────────────────────────────────────────────────────────────────────
// transaction.state.ts
// ─────────────────────────────────────────────────────────────────────────
import { EntityAdapter, EntityState, createEntityAdapter } from '@ngrx/entity';

export interface TransactionState extends EntityState<Transaction> {
  selectedId:      string | null;
  loading:         boolean;
  error:           string | null;
  totalElements:   number;
  totalPages:      number;
  filters:         TransactionFilters;
  summary:         DashboardSummary | null;
  aiResponse:      string;
  aiLoading:       boolean;
}

export const adapter: EntityAdapter<Transaction> =
  createEntityAdapter<Transaction>({ selectId: t => t.id });

export const initialFilters: TransactionFilters = {
  page: 0, size: 20
};

export const initialState: TransactionState = adapter.getInitialState({
  selectedId:    null,
  loading:       false,
  error:         null,
  totalElements: 0,
  totalPages:    0,
  filters:       initialFilters,
  summary:       null,
  aiResponse:    '',
  aiLoading:     false,
});

// ─────────────────────────────────────────────────────────────────────────
// transaction.reducer.ts
// ─────────────────────────────────────────────────────────────────────────
import { createReducer, on } from '@ngrx/store';

export const transactionReducer = createReducer(
  initialState,

  on(TransactionActions.load, state => ({ ...state, loading: true, error: null })),

  on(TransactionActions.loadSuccess, (state, { response }) =>
    adapter.setAll(response.content, {
      ...state,
      loading:       false,
      totalElements: response.totalElements,
      totalPages:    response.totalPages,
    })
  ),

  on(TransactionActions.loadFailure, (state, { error }) =>
    ({ ...state, loading: false, error })
  ),

  on(TransactionActions.wsUpdate, (state, { transaction }) =>
    adapter.upsertOne(transaction, state)
  ),

  on(TransactionActions.select, (state, { id }) =>
    ({ ...state, selectedId: id })
  ),

  on(TransactionActions.applyFilters, (state, { filters }) =>
    ({ ...state, filters: { ...state.filters, ...filters, page: 0 } })
  ),

  on(TransactionActions.summarySuccess, (state, { summary }) =>
    ({ ...state, summary })
  ),

  on(TransactionActions.aiQuery, state =>
    ({ ...state, aiLoading: true, aiResponse: '' })
  ),

  on(TransactionActions.aiToken, (state, { token }) =>
    ({ ...state, aiResponse: state.aiResponse + token })
  ),

  on(TransactionActions.aiComplete, state =>
    ({ ...state, aiLoading: false })
  ),

  on(TransactionActions.aiError, (state, { error }) =>
    ({ ...state, aiLoading: false, aiResponse: `[Error: ${error}]` })
  ),

  on(TransactionActions.aiClear, state =>
    ({ ...state, aiResponse: '', aiLoading: false })
  ),
);

// ─────────────────────────────────────────────────────────────────────────
// transaction.selectors.ts
// ─────────────────────────────────────────────────────────────────────────
import { createFeatureSelector, createSelector } from '@ngrx/store';

export const selectFeature = createFeatureSelector<TransactionState>('transactions');

export const { selectAll, selectEntities } = adapter.getSelectors(selectFeature);

export const selectLoading      = createSelector(selectFeature, s => s.loading);
export const selectError        = createSelector(selectFeature, s => s.error);
export const selectFilters      = createSelector(selectFeature, s => s.filters);
export const selectTotalElements= createSelector(selectFeature, s => s.totalElements);
export const selectSummary      = createSelector(selectFeature, s => s.summary);
export const selectAiResponse   = createSelector(selectFeature, s => s.aiResponse);
export const selectAiLoading    = createSelector(selectFeature, s => s.aiLoading);
export const selectSelectedId   = createSelector(selectFeature, s => s.selectedId);

export const selectSelectedTransaction = createSelector(
  selectEntities, selectSelectedId,
  (entities, id) => id ? entities[id] : null
);

export const selectFlaggedTransactions = createSelector(
  selectAll, txns => txns.filter(t => t.status === 'FLAGGED')
);

export const selectHighRiskTransactions = createSelector(
  selectAll, txns => txns.filter(t => t.riskScore >= 70).sort((a, b) => b.riskScore - a.riskScore)
);
