import type { Arm } from '../../contract';
import { armRoutes } from '../../shared/arm-routes';
import { St14Grid } from './grid-store';
import { St14Editor } from './editor-store';

/** `@signaltree/core` 14.1.3: `entityMap` collections, no enhancers. */
const ARM: Arm = {
  id: 'st14',
  label: 'SignalTree 14.1.3 (@signaltree/core)',
  library: { name: '@signaltree/core', specifier: '@signaltree/core' },
  createGrid: () => new St14Grid(),
  createEditor: (seed) => new St14Editor(seed),
};

export const ROUTES = armRoutes(ARM);
