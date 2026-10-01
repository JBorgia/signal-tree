import type { Arm } from '../../contract';
import { armRoutes } from '../../shared/arm-routes';
import { St15Grid } from './grid-store';
import { St15Editor } from './editor-store';

/** The candidate (`st15-candidate-enhanced`, a second install of the same tarballs) with transactions() and restoration() installed. */
const ARM: Arm = {
  id: 'st15-undo',
  label:
    'SignalTree candidate + transactions() + restoration() (installed, idle)',
  library: {
    name: '@signal-tree/angular',
    specifier: 'st15-candidate-enhanced',
  },
  createGrid: () => new St15Grid(),
  createEditor: (seed) => new St15Editor(seed),
};

export const ROUTES = armRoutes(ARM);
