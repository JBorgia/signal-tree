import { getPathNotifier } from '../path-notifier';
import { hidingMembers } from './plain-branch-membership';

/**
 * @internal Run a reversal or rollback of `root`'s tree so that path
 * observers see what the tree exposes (v15 port review, item 4). The
 * operation writes retained storage too (`physicalRows`): a location it
 * leaves absent (it, or a member above it, omitted) holds a retained value,
 * which went out to path subscribers and Link endpoints while the location
 * read absent. Such a realized write is now not published; the membership
 * change that hides the location is. Checked when the write is announced,
 * after the operation installed its members.
 */
export function publishingExposedOnly<R>(root: object, run: () => R): R {
  const notifier = getPathNotifier();
  const outer = notifier.absentRealized;
  // Replaced, not composed: a reversal of another tree run from inside this
  // one (a tap, a subscriber) gates its own tree's writes; this one's come
  // before or after it.
  notifier.absentRealized = (positionIds, meta) =>
    meta?.participation === 'realized' &&
    positionIds?.[0] !== undefined &&
    !!hidingMembers(root, positionIds[0])?.length;
  try {
    return run();
  } finally {
    notifier.absentRealized = outer;
  }
}
