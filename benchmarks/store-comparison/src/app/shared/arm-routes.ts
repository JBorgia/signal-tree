import type { Routes } from '@angular/router';
import type { Arm } from '../contract';
import { ARM } from './tokens';
import { BenchHost } from './host';

/** A single route rendering the shared host with this arm provided. */
export function armRoutes(arm: Arm): Routes {
  return [
    {
      path: '',
      component: BenchHost,
      providers: [{ provide: ARM, useValue: arm }],
    },
  ];
}
