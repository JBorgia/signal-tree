/**
 * What a given TREE can answer — not what Studio supports.
 *
 * ⚠️ A global "Studio supports transactions = true" would be subtly wrong. Two
 * trees in one application can have different enhancer compositions, so
 * capability travels with the tree (see `listTrees`), never with the handshake.
 */
export type StudioCapability = 'committed-transactions' | 'realizations';

/**
 * The canonical name for leaf realization observation (S2).
 *
 * ⚠️ NOT YET ADVERTISED BY `listTrees`. It exists so a refusal can name the
 * capability it actually refused: `startRealizationCapture` previously reported
 * `committed-transactions` when leaf observation was unavailable, which
 * detected the right condition and stated the wrong reason. Advertising it on
 * attachments is a separate decision — it changes what every attached tree
 * reports — and is deliberately not taken here.
 */
export const REALIZATION_CAPABILITY = 'realizations' satisfies StudioCapability;

/** Widened by later slices: realizations (S2), restoration (S3), structural (S4). */
export const S1_CAPABILITIES: readonly StudioCapability[] = [
  'committed-transactions',
];
