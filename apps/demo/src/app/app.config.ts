import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { appRoutes } from './app.routes';
import { provideRouteMetadata } from './shared/route-metadata';
import { provideAppTree } from './store';

const ROUTE_SCROLL_OFFSET: [number, number] = [0, 80];

const configureRouteScrolling = (): void => {
  inject(ViewportScroller).setOffset(ROUTE_SCROLL_OFFSET);
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    provideRouteMetadata(),
    provideHttpClient(withXhr()),
    // Provide the canonical SignalTree application tree (see store/)
    ...provideAppTree(),
    provideAppInitializer(configureRouteScrolling),
  ],
};
