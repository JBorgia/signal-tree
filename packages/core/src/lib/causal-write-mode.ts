import type { CausalWriteMode, UpdateMetadata } from './types';

export const getCausalWriteMode = (
  meta?: Pick<UpdateMetadata, 'causalMode'> | undefined
): CausalWriteMode => meta?.causalMode ?? 'authoring';

/**
 * DEVTOOLS-JUMP-0. A diagnostic state application participates in none of
 * SignalTree's causal mechanisms: it is not authored work, and it is not truth
 * any authority has a right to preserve. The fact that a developer LOOKED at
 * state B cannot make an application rollback from C to A illegal.
 *
 * Deliberately keyed on participation rather than on `source === 'devtools'`:
 * coupling policy to provenance is the compression these audits keep undoing.
 */
export const isInspectionWrite = (
  meta?: Pick<UpdateMetadata, 'causalMode'> | undefined
): boolean => meta?.causalMode === 'inspection';
