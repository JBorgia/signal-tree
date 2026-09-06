import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { provideEchartsCore } from 'ngx-echarts';

import { appRoutes } from './app.routes';
import { provideRouteMetadata } from './shared/route-metadata';
import { provideAppTree } from './store';

const ROUTE_SCROLL_OFFSET: [number, number] = [0, 80];

const configureRouteScrolling = (): void => {
  inject(ViewportScroller).setOffset(ROUTE_SCROLL_OFFSET);
};

// Register only what we need for our charts
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  CanvasRenderer,
]);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      appRoutes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      })
    ),
    provideRouteMetadata(),
    provideHttpClient(withXhr()),
    // Provide ECharts core for ngx-echarts
    provideEchartsCore({ echarts }),
    // Provide the canonical SignalTree application tree (see store/)
    ...provideAppTree(),
    provideAppInitializer(configureRouteScrolling),
  ],
};
