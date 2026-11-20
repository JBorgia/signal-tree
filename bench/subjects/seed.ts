/**
 * Subject-neutral markers a scenario puts in an initial state. Each subject
 * turns them into its own structures (15.4.9: entityMap()).
 */
export const COLLECTION_SEED = '__benchCollectionSeed';

export interface CollectionSeed {
  readonly [COLLECTION_SEED]: true;
  readonly idField: string;
}

/** Requests a keyed collection, keyed by `idField`, at this key of the state. */
export function collectionSeed(idField: string): CollectionSeed {
  return { [COLLECTION_SEED]: true, idField };
}

export function isCollectionSeed(value: unknown): value is CollectionSeed {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>)[COLLECTION_SEED] === true;
}
