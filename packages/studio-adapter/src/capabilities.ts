/**
 * What a given TREE can answer — not what Studio supports.
 *
 * ⚠️ A global "Studio supports transactions = true" would be subtly wrong. Two
 * trees in one application can have different enhancer compositions, so
 * capability travels with the tree (see `listTrees`), never with the handshake.
 */
export type StudioCapability = 'committed-transactions';

/** Widened by later slices: realizations (S2), restoration (S3), structural (S4). */
export const S1_CAPABILITIES: readonly StudioCapability[] = [
  'committed-transactions',
];
