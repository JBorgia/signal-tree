import type { TreeId } from './position-registry';

// Build-time dev flag. Declared locally rather than inherited from
// `@angular/core`'s ambient types: it is a bundler convention, not a framework
// API, and the kernel's declarations must not depend on Angular for it.
declare const ngDevMode: boolean | undefined;

/**
 * A process-wide observer for errors SignalTree explicitly REPORTS.
 *
 * ⚠️ NOT "every error the library catches" — that was the original aspiration
 * and it was never true. The measured producer inventory is deliberately narrow:
 * `link` and `stored`. Every other catch site still handles its own error
 * locally and does not participate here.
 *
 * ## Why this exists
 *
 * A capability audit against NGXS found `NgxsUnhandledErrorHandler` and nothing
 * equivalent anywhere else, ours included. The gap is real and narrow: a
 * `stored()` write that fails, an `asyncSource` loader that rejects, an
 * an async loader that rejects — each is caught at its own site and turned into
 * local error state, which is correct, and each is therefore invisible to
 * anything that wants to see ALL of them. Reporting to Sentry meant wiring a
 * per-marker `onError` at every call site and remembering to do it forever.
 *
 * This does NOT change how errors are handled. Every existing catch still runs,
 * still sets its local error state, still calls its own `onError`. This is an
 * additional observation point, and a listener that throws cannot break the
 * operation that reported to it.
 *
 * Deliberately NOT a handler: it cannot swallow, retry or transform. Making it
 * capable of that would mean every marker's error path depends on whatever a
 * listener decides, which is a much larger promise than "tell me when something
 * failed".
 */

/** Where the error came from. Closed union — adding a source is a core change. */
/**
 * What a listener receives when SignalTree catches an error it cannot handle.
 *
 * ⚠️ MINIMAL BY MEASUREMENT, not by taste. `source` and `detail` were both
 * DELETED rather than hidden:
 *
 * ```text
 * source   7-member union, 4 with no producer; the survivors duplicated
 *          `operation` ('link' / 'link:set'); ZERO code branched on it
 * detail   one producer (stored), zero consumers; DEV-only prose
 * ```
 *
 * ⚠️ Deletion rather than a TypeScript-only projection is deliberate. This
 * reporter hands every listener THE SAME OBJECT it was given — there is no copy
 * — so narrowing the interface while still passing the fields would leave them
 * inspectable from JavaScript. That would be two truths about one event, which
 * is precisely the class of defect this audit keeps finding.
 */
export interface TreeErrorEvent {
  /** The thrown value, unwrapped as far as it was thrown. */
  readonly error: unknown;
  /**
   * What was being attempted — `link:set`, `read`, `write`, `migrate`,
   * `remove`.
   *
   * ⚠️ Deliberately `string`, NOT a union. It is a diagnostic vocabulary, and
   * an exhaustively enumerated forever-list of every internal operation has not
   * been earned.
   */
  readonly operation: string;
  /**
   * WHICH TREE emitted this.
   *
   * ⚠️ REQUIRED, and that is load-bearing. Two same-shaped trees produce
   * identical `operation` and `path`, so without this a process-global observer
   * cannot attribute or route anything — the same lesson NOTIFIER-SCOPE-0 cost
   * us, arriving in diagnostics.
   */
  readonly treeId: TreeId;
  /**
   * The SignalTree STATE LOCATION associated with the report, when the
   * reporting site knows it.
   *
   * ⚠️ ONE meaning for every producer — Link reports the linked source's
   * `ownerPath`, `stored` reports its node's `ownerPath`, NOT its storage key.
   * A field whose meaning varied by producer would be the same defect as the
   * `source` and `detail` fields this event deleted.
   *
   * Location, never identity: two trees of the same shape share this string,
   * which is exactly why `treeId` is required.
   */
  readonly path?: string;
}

const listeners = new Set<(event: TreeErrorEvent) => void>();

/**
 * Observe every error the library catches. Returns an unsubscribe function.
 *
 * Fires for errors that were ALREADY handled locally — the marker has set its
 * error state and the app may show it. This is for reporting, not recovery.
 */
export function onTreeError(
  listener: (event: TreeErrorEvent) => void
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Report a caught error. Never throws.
 *
 * A listener that throws must not take down the operation that reported to it —
 * that would make adding error REPORTING a source of errors, and the failure
 * would surface at whichever marker happened to report first, which is the
 * least debuggable outcome available.
 */
export function reportTreeError(event: TreeErrorEvent): void {
  if (listeners.size === 0) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.error(
          'SignalTree: an onTreeError listener threw. The original error was ' +
            'still handled normally; this is the listener failing. [ST2025]',
          err
        );
      }
    }
  }
}

/** Test seam — listeners are module-global, so a spec must be able to reset. */
export function clearTreeErrorListenersForTesting(): void {
  listeners.clear();
}
