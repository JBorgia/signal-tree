import type { WriteParticipation, WriteMetadata } from './types';

/**
 * Read a write's participation — how it may take part in SignalTree's causal
 * mechanisms.
 *
 * ABSENCE IS NOT AN ERROR. An absent `participation` means ordinary authored
 * application work, and the runtime deliberately does not materialise
 * `'authored'` on every write to make the conceptual table look symmetrical. The
 * same holds for the other axis: an absent `origin` means no positive provenance
 * was recorded, which is the normal case for application work (A1-N).
 */
export const getWriteParticipation = (
  meta?: Pick<WriteMetadata, 'participation'> | undefined
): WriteParticipation => meta?.participation ?? 'authored';

/**
 * DEVTOOLS-JUMP-0. A diagnostic state application participates in none of
 * SignalTree's causal mechanisms: it is not authored work, and it is not truth
 * any authority has a right to preserve. The fact that a developer LOOKED at
 * state B cannot make an application rollback from C to A illegal.
 *
 * Deliberately keyed on participation rather than on `origin === 'devtools'`:
 * coupling policy to provenance is the compression these audits keep undoing.
 */
export const isInspectionWrite = (
  meta?: Pick<WriteMetadata, 'participation'> | undefined
): boolean => meta?.participation === 'inspection';

/**
 * Is this write a transaction's own compensation — the restore half of a
 * rollback?
 *
 * A rollback is `participation: 'realized'` because it is not authored user
 * work, but it is emphatically NOT external truth: it restores a value
 * SignalTree itself produced, from a baseline SignalTree itself captured. The
 * transaction enhancer stamps `origin: 'transaction-rollback'` for exactly this
 * reason — its own comment says that without it "a compensation turn was
 * indistinguishable from external truth".
 *
 * That fact existed and nothing consumed it. Restoration's P0-C provenance
 * index recorded compensation as external truth, so an abandoned speculative
 * turn poisoned the undo of an EARLIER authored turn: rollback restored the
 * authored value, the index called that value foreign, and the next `undo()`
 * refused with ST1034 to avoid overwriting truth it did not own. Reproduced in
 * `packages/angular/src/lib/native-storage-0-contract.spec.ts`.
 *
 * Keyed on origin rather than on the presence of `transactionId`, which is also
 * stamped on the speculative writes themselves — those ARE authored and must
 * keep superseding external truth.
 */
export const isCompensationWrite = (
  meta?: Pick<WriteMetadata, 'origin'> | undefined
): boolean => meta?.origin === 'transaction-rollback';
