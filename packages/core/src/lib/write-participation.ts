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
