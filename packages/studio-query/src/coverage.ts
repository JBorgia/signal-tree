/**
 * What a query result can and cannot claim about completeness.
 *
 * ⚠️ EVERY query that could report absence must carry this. `undefined` from a
 * lookup means "no retained attributable evidence", NEVER "it did not happen".
 */
export interface RealizationCoverage {
  /** Always false until a mechanism can prove capture preceded all activity. */
  readonly completeFromTreeStart: false;
  readonly scopeIntegrity: 'complete' | 'incomplete-unscoped-evidence';
  readonly startedAtSequence: number;
  readonly truncated: boolean;
  readonly firstRetainedSequence?: number;
}

/** Why a query cannot make a stronger claim. */
export type UnknownReason =
  | 'no-correlation-referent'
  | 'capture-started-late'
  | 'history-truncated'
  | 'scope-incomplete'
  | 'value-unserializable'
  | 'no-retained-evidence';

/**
 * Reasons the coverage itself prevents a strong absence claim. Empty means an
 * absence result may be stated plainly.
 */
export function absenceCaveats(
  coverage: RealizationCoverage
): readonly UnknownReason[] {
  const caveats: UnknownReason[] = [];
  if (!coverage.completeFromTreeStart) caveats.push('capture-started-late');
  if (coverage.scopeIntegrity !== 'complete') caveats.push('scope-incomplete');
  if (coverage.truncated) caveats.push('history-truncated');
  return caveats;
}
