import { getLocationRuntime } from '../location-runtime';

/** Internal, per-invocation receipt. Never brand the consumer's reusable error. */
class AppliedDeliveryFailure {
  constructor(readonly cause: unknown) {}
}

export function wasAppliedBeforeFailure(error: unknown): boolean {
  return error instanceof AppliedDeliveryFailure;
}

/** Public operation boundaries preserve the original thrown value/identity. */
export function applicationFailureCause(error: unknown): unknown {
  return error instanceof AppliedDeliveryFailure ? error.cause : error;
}

/**
 * Mark only delivery after this invocation's apply callback completed. An
 * internal receipt travels through bookkeeping, then is unwrapped at the
 * public operation boundary. Reusing a consumer Error cannot transfer a prior
 * operation's outcome to a later failed application.
 */
export function applyInInvalidationGroup(
  root: object,
  apply: () => void,
  complete?: () => void
): void {
  const locations = getLocationRuntime(root);
  let applied = false;
  let failed=false,first:unknown;
  try {
    const run = () => {apply();applied=true;};
    if (locations) locations.runInvalidationGroup(run);else run();
  }catch(error){failed=true;first=error;}
  // An owned completion may exist even if a later notification threw.
  try{complete?.();}catch(error){if(!failed){failed=true;first=error;}}
  if(failed){const cause=applicationFailureCause(first);throw applied?new AppliedDeliveryFailure(cause):cause;}
}
