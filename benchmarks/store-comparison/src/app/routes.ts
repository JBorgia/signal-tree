import type { Routes } from '@angular/router';

/**
 * One lazy route per arm. An arm's library is imported only from its own folder, so it lands in
 * that arm's lazy chunk and an arm never loads another arm's library. Shared code (grid, editor,
 * driver) is identical for every arm.
 */
export const ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./shared/blank').then((m) => m.BlankPage),
  },
  {
    path: 'signals',
    loadChildren: () => import('./arms/signals/arm').then((m) => m.ROUTES),
  },
  {
    path: 'ngrx',
    loadChildren: () => import('./arms/ngrx/arm').then((m) => m.ROUTES),
  },
  {
    path: 'st14',
    loadChildren: () => import('./arms/st14/arm').then((m) => m.ROUTES),
  },
  {
    path: 'st15-released',
    loadChildren: () =>
      import('./arms/st15-released/arm').then((m) => m.ROUTES),
  },
  {
    path: 'st15-candidate',
    loadChildren: () =>
      import('./arms/st15-candidate/arm').then((m) => m.ROUTES),
  },
];
