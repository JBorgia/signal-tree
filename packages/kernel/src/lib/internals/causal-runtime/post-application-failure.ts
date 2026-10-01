import { getLocationRuntime } from '../location-runtime';
import { isTraversableNode } from '../node-shape';

/**
 * A reversal that was fully installed, after which a consumer threw while its
 * invalidation group delivered. The operation HAPPENED. Treating that throw as
 * "nothing applied" left owners incoherent: an undo kept its entry applied
 * while the tree showed the reversed value, and an explicit rollback reported a
 * refusal with its turn still pending although compensation had landed.
 *
 * Identity, not message: the marked error object is the one the consumer threw.
 */
const APPLIED_BEFORE_FAILURE = new WeakSet<object>();

function mark(error: unknown): unknown {
  if (isTraversableNode(error)) {
    APPLIED_BEFORE_FAILURE.add(error as object);
    return error;
  }
  // A primitive cannot be marked by identity; carry it as the cause.
  const carrier = Object.assign(new Error(String(error)), { cause: error });
  APPLIED_BEFORE_FAILURE.add(carrier);
  return carrier;
}

export function wasAppliedBeforeFailure(error: unknown): boolean {
  return (
    isTraversableNode(error) && APPLIED_BEFORE_FAILURE.has(error as object)
  );
}

/**
 * Run an application inside the tree's invalidation group. A throw from the
 * group's delivery after `apply` returned is marked as a post-application
 * failure; a throw from `apply` itself is rethrown unchanged.
 */
export function applyInInvalidationGroup(
  root: object,
  apply: () => void
): void {
  const locations = getLocationRuntime(root);
  if (!locations) {
    apply();
    return;
  }
  let applied = false;
  try {
    locations.runInvalidationGroup(() => {
      apply();
      applied = true;
    });
  } catch (error) {
    throw applied ? mark(error) : error;
  }
}
