/**
 * ONE semantic operation: read a value without becoming a reactive consumer.
 *
 * WHY THIS EXISTS. Write bookkeeping has to read a leaf's current value — to
 * short-circuit a reference-identical `.set()`, and to compute before/after for
 * mutation emission. Those reads are the KERNEL asking a question about state,
 * not a consumer subscribing to it. On a runtime with automatic dependency
 * tracking, doing that read inside a tracking scope would silently enrol the
 * writer as a dependent of the very leaf it is writing.
 *
 * WHAT THIS IS NOT. It is not a reactive runtime, and it must not grow into
 * one. There is no `signal()`, no `computed()`, no `effect()`, no scheduler —
 * the same rule `materialization-realization.ts` states for its two methods:
 *
 *     DON'T PORT FRAMEWORK PRIMITIVES. PORT THE SIGNALTREE SEMANTICS THAT
 *     CAUSED THEM TO BE USED.
 *
 * Angular happens to spell this `untracked`. That spelling is an implementation
 * detail of one realization; the kernel's requirement is the suppression, not
 * the name.
 *
 * ⚠️ THE DEFAULT IS `fn()`, AND THAT IS CORRECT — for a realization with no
 * automatic tracking there is no dependency to suppress. It is NOT a safe
 * default for a tracking realization, which is why the realization installs its
 * own implementation, exactly as it installs `MaterializationRealization`.
 */
export type TrackingSuppression = <T>(fn: () => T) => T;

export const NEUTRAL_TRACKING_SUPPRESSION: TrackingSuppression = <T>(
  fn: () => T
): T => fn();
