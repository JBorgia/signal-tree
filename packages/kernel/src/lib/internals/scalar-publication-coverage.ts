import type { WriteMetadata } from '../mutation-types';
import type { ScalarSlotCommitResult } from './tree-scalar-slot-runtime';

// A receipt of recipient participation, never publication permission.
const COVERAGE = Symbol('ScalarPublicationCoverage');
const CONTRIBUTIONS = Symbol('ScalarNotificationContributions');
export type ScalarNotificationContribution = Readonly<{
  meta: WriteMetadata;
  value: unknown;
  revision: number;
}>;
type ContributionChain =
  | { readonly entry: ScalarNotificationContribution }
  | { readonly left: ContributionChain; readonly right: ContributionChain };
type Covered = WriteMetadata & {
  readonly [COVERAGE]?: readonly object[];
  readonly [CONTRIBUTIONS]?: ContributionChain;
};
export function withScalarPublicationCoverage(
  meta: WriteMetadata | undefined,
  recipients: readonly object[] | undefined
): WriteMetadata {
  const result: Covered = { ...meta, [COVERAGE]: recipients };
  return result;
}
export function scalarPublicationCovers(
  meta: WriteMetadata | undefined,
  channel: object
): boolean {
  return (meta as Covered | undefined)?.[COVERAGE]?.includes(channel) === true;
}
export function mergeScalarPublicationCoverage(
  left: WriteMetadata,
  right: WriteMetadata,
  merged: WriteMetadata | undefined
): WriteMetadata | undefined {
  // This view is private to projection subscribers. Generic delivery keeps
  // its existing undefined metadata when attribution cannot be merged.
  const base =
    merged ?? (left.ownerId === right.ownerId ? { ownerId: left.ownerId } : {});
  const a = (left as Covered)[COVERAGE],
    b = (right as Covered)[COVERAGE];
  // Every coalesced contribution must be covered for a recipient. Undefined
  // is an uncovered contribution, not an empty list that can be discarded.
  const result: Covered = withScalarPublicationCoverage(
    base,
    a && b ? a.filter((channel) => b.includes(channel)) : undefined
  );
  const l = (left as Covered)[CONTRIBUTIONS],
    r = (right as Covered)[CONTRIBUTIONS];
  const combined: Covered =
    l && r ? { ...result, [CONTRIBUTIONS]: { left: l, right: r } } : result;
  return combined;
}
export function scalarFrameMetadata(
  result: ScalarSlotCommitResult | undefined,
  slot: number | undefined,
  meta: WriteMetadata
): WriteMetadata {
  return withScalarPublicationCoverage(
    meta,
    slot === undefined ? undefined : result?.publication?.coverage.get(slot)
  );
}

/** Capture before batching; values are notification payloads, never late reads. */
export function stampScalarNotification(
  meta: WriteMetadata | undefined,
  value: unknown,
  revision: number
): WriteMetadata {
  const original: Covered = { ...meta };
  delete (original as { [CONTRIBUTIONS]?: unknown })[CONTRIBUTIONS];
  const result: Covered = {
    ...original,
    [CONTRIBUTIONS]: { entry: { meta: original, value, revision } },
  };
  return result;
}
export function scalarNotificationContributions(
  meta: WriteMetadata | undefined
): Iterable<ScalarNotificationContribution> | undefined {
  const root = (meta as Covered | undefined)?.[CONTRIBUTIONS];
  if (!root) return undefined;
  // Persistent concatenation is O(1) per enqueue; iterative traversal avoids
  // recursion on a long coalesced turn. No history survives the queued entry.
  return (function* () {
    const pending = [root];
    while (pending.length) {
      const next = pending.pop()!;
      if ('entry' in next) yield next.entry;
      else pending.push(next.right, next.left);
    }
  })();
}
