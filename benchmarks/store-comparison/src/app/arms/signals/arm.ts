import type { Arm } from '../../contract';
import { armRoutes } from '../../shared/arm-routes';
import { SignalsGrid } from './grid-store';
import { SignalsEditor } from './editor-store';

/**
 * Hand-written Angular signals: what a competent developer writes with no state library.
 * A Map of per-row writable signals + an ids signal + a computed for the status counts.
 */
const ARM: Arm = {
  id: 'signals',
  label: 'Angular signals (hand-written)',
  createGrid: () => new SignalsGrid(),
  createEditor: (seed) => new SignalsEditor(seed),
};

export const ROUTES = armRoutes(ARM);
