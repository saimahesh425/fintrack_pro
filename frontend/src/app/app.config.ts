import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { transactionReducer } from './core/store/transaction.store';
import { TransactionEffects } from './core/store/transaction.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideStore({ transactions: transactionReducer }),
    provideEffects([TransactionEffects]),
    provideStoreDevtools({ maxAge: 25, logOnly: false }),
  ]
};
