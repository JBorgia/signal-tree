import type { Arm } from '../../contract';
import { armRoutes } from '../../shared/arm-routes';
import { St15Grid } from './grid-store';
import { St15Editor } from './editor-store';

/** `@signal-tree/angular` 15.3.1 (npm alias `st15-candidate`): `entityMap` + a `derived` recipe. */
const ARM: Arm = {
  id: 'st15-candidate',
  label: 'SignalTree candidate (@signal-tree/angular, packed tarball)',
  library: { name: '@signal-tree/angular', specifier: 'st15-candidate' },
  createGrid: () => new St15Grid(),
  createEditor: (seed) => new St15Editor(seed),
};

export const ROUTES = armRoutes(ARM);
