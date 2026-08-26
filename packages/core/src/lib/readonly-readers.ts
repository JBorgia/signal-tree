import type { EntitySignal } from './types';

/**
 * Readers on {@link EntitySignal}. Mutators (`addOne`, `upsertOne`,
 * `removeWhere`, `setAll`, ...) and the hook registrars (`tap`, `intercept` -
 * lifecycle capabilities, not state reads) are deliberately absent.
 * `byId`/`byIdOrFail` are not in this list because they are re-signed.
 */
export const ENTITY_READERS = [
  'all',
  'count',
  'ids',
  'has',
  'empty',
  'asMap',
  'where',
  'find',
] as const satisfies readonly (keyof EntitySignal<unknown, string | number>)[];

