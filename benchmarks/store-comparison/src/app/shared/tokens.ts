import { InjectionToken } from '@angular/core';
import type { Arm, GridStore } from '../contract';

/** The arm under test; provided by the arm's route (shared/arm-routes). */
export const ARM = new InjectionToken<Arm>('bench.arm');
/** The grid store of the live host; provided by the host component for its children. */
export const GRID = new InjectionToken<GridStore>('bench.grid');

/** Rows rendered by the grid: the first VISIBLE ids in server order. */
export const VISIBLE = 50;
