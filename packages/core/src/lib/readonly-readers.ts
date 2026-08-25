import type { AsyncSourceSignal } from './markers/async-source';
import type { EntityLoaderSurface } from './markers/entity-loader';
import type { StoredSignal } from './markers/stored';
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

/**
 * Readers on {@link EntityLoaderSurface}. `load`/`loadOrThrow`/`refresh`/
 * `invalidate` all mutate loader state and are deliberately absent.
 */
export const ENTITY_LOADER_READERS = [
  'loading',
  'loaded',
  'error',
  'lastLoadedAt',
  'params',
] as const satisfies readonly (keyof EntityLoaderSurface<unknown>)[];

/** Readers on {@link StoredSignal}. The mutators are absent. */
export const STORED_READERS = ['key', 'version'] as const satisfies readonly (keyof StoredSignal<unknown>)[];

/** Readers on {@link AsyncSourceSignal}. Mutators are absent. */
export const ASYNC_SOURCE_READERS = [
  'data',
  'loading',
  'error',
] as const satisfies readonly (keyof AsyncSourceSignal<unknown>)[];

