import { InjectionToken } from '@angular/core';
import type { Arm, GridStore } from '../contract';

/** The arm under test; provided by the arm's route (shared/arm-routes). */
export const ARM = new InjectionToken<Arm>('bench.arm');
/** The grid store of the live host; provided by the host component for its children. */
export const GRID = new InjectionToken<GridStore>('bench.grid');

/** Rows rendered by the grid: the first VISIBLE ids in server order. */
export const VISIBLE = 50;

/**
 * `?footer=0` leaves the status chips out, so nothing reads `statusCounts` while timing. Every
 * arm's counts recount all rows, which made per-edit cost grow with N in every arm; this variant
 * isolates the store's own write cost. Counts are still checked against the rows (untimed).
 */
export const FOOTER =
  typeof location === 'undefined' ||
  new URLSearchParams(location.search).get('footer') !== '0';
