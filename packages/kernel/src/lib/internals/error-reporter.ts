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
 * `link`, plus (15.3.1) an observer error that the path notifier
 * or a transaction turn listener CONTAINED rather than let escape
 * ({@link reportContainedObserverError}). Every other catch site still handles
 * its own error locally and does not participate here.
 *
 * ## Why this exists
 *
 * A capability audit against NGXS found `NgxsUnhandledErrorHandler` and nothing
 * equivalent anywhere else, ours included. Earlier marker-based APIs had local
 * error hooks; those markers were removed in v15. Current producers are the
 * explicit reporting sites listed above. This observer does not imply that
 * every application request failure or framework callback error is reported.
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
   * What was being attempted, for example `link`, `link:set`,
   * `notify:subscriber`, or `transaction:listener`.
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
 *
 * @returns whether at least one listener took the report without throwing,
 * so a producer that must not go silent can fall back when nobody did.
 */
export function reportTreeError(event: TreeErrorEvent): boolean {
  if (listeners.size === 0) return false;
  let received = false;
  for (const listener of listeners) {
    try {
      listener(event);
      received = true;
    } catch (err) {
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        safeConsoleError(
          'SignalTree: an onTreeError listener threw. The original error was ' +
            'still handled normally; this is the listener failing. [ST2025]',
          err
        );
      }
    }
  }
  return received;
}

/**
 * `console.error` that cannot throw. Reporting must never become a new source
 * of errors: a throwing console (a fail-on-console test harness, an override)
 * inside a flush would drop the rest of the batch, the failure this reporter
 * exists to prevent.
 */
function safeConsoleError(message: string, error?: unknown): void {
  try {
    if (error === undefined) console.error(message);
    else console.error(message, error);
  } catch {
    // Nothing further can be reported without risking the same failure.
  }
}

// TX-REPORT-BUDGET-0. At most this many contained errors per tree reach
// onTreeError listeners within one window; the rest of that window's go to
// the console only. A listener that writes on every report, with an observer
// that throws on every write, otherwise loops: synchronously inside a flush,
// or as a microtask chain through link() or a deferred write. Fast chains
// exhaust the budget; slower chains can continue across windows. This is
// rate limiting, not a termination guarantee.
//
// The window is read from the clock at report time rather than reset by a
// timer: a timer can be missing (worklets, sandboxes), throw, or be faked and
// never fire, and a reporter must never throw or wedge. Per tree, so one
// noisy tree cannot starve another's reports.
const CONTAINED_REPORT_BUDGET = 50;
const CONTAINED_REPORT_WINDOW_MS = 1000;
type ReportWindow = { start: number; count: number };
// Registration follows tree lifetime. A report cannot create a new owner.
// The undefined key is one shared window for detached reports, never a dead ID.
const containedReportWindows = new Map<TreeId | undefined, ReportWindow | null>();

export function registerContainedReportBudget(treeId: TreeId): void {
  containedReportWindows.set(treeId, null);
}

function takeContainedReportBudget(treeId: TreeId): boolean {
  let now = 0;
  try {
    now = Date.now();
  } catch {
    // A clock that throws leaves one window open; still bounded.
  }
  const owner = containedReportWindows.has(treeId) ? treeId : undefined;
  let window = containedReportWindows.get(owner);
  if (!window || now - window.start >= CONTAINED_REPORT_WINDOW_MS) {
    window = { start: now, count: 0 };
    containedReportWindows.set(owner, window);
  }
  if (window.count >= CONTAINED_REPORT_BUDGET) {
    // One count past the budget records that its exhaustion was announced.
    if (window.count === CONTAINED_REPORT_BUDGET && listeners.size > 0) {
      window.count++;
      safeConsoleError(
        `SignalTree: more than ${CONTAINED_REPORT_BUDGET} contained observer errors for one tree within a second; further ones go to the console only, not onTreeError. [ST2034]`
      );
    }
    return false;
  }
  window.count++;
  return true;
}

/**
 * Report an error an OBSERVER threw and SignalTree contained
 * (TX-OBSERVER-STRAND-0): a write subscriber during deferred delivery, or a
 * transaction turn listener (onPendingCreated/Confirmed/Discarded). The write
 * or turn it observed already exists, so the error must not escape into
 * whoever flushed.
 *
 * Goes to `onTreeError` like any other report, up to a per-tree budget per
 * window (see TX-REPORT-BUDGET-0). The console line [ST2034] is explicit and never silent:
 *
 * - in development it is ALWAYS written, because a listener that returns
 *   normally may still have ignored the event (one filtering on `link:set`,
 *   or routing by tree);
 * - in production it is written when no listener took the report (none
 *   registered, or every one threw), the failure names no tree, or the
 *   tree's report budget for the window is spent.
 *
 * These errors used to throw; containing them must not make them silent.
 */
export function reportContainedObserverError(event: {
  readonly error: unknown;
  readonly operation: 'notify:subscriber' | 'transaction:listener';
  readonly treeId?: TreeId;
  readonly path?: string;
}): void {
  const { error, operation, treeId, path } = event;
  let received = false;
  if (treeId !== undefined) {
    if (takeContainedReportBudget(treeId)) {
      received = reportTreeError({
        error,
        operation,
        treeId,
        ...(path === undefined ? {} : { path }),
      });
    }
  }
  if (received && !(typeof ngDevMode === 'undefined' || ngDevMode)) {
    return;
  }
  safeConsoleError(
    operation === 'notify:subscriber'
      ? `SignalTree: a write subscriber threw while observing '${path}'; delivery continued. [ST2034]`
      : 'SignalTree: a transaction turn listener threw; the transaction continued. [ST2034]',
    error
  );
}

/** Test seam: reset the contained-report budget between specs. */
export function resetContainedReportBudgetForTesting(): void {
  for (const id of containedReportWindows.keys())
    containedReportWindows.set(id, null);
}

/** Test seam — listeners are module-global, so a spec must be able to reset. */
export function clearTreeErrorListenersForTesting(): void {
  listeners.clear();
}

/** Internal lifetime diagnostic; never forwarded by a package entrypoint. */
export function getContainedReportBudgetSizeForTesting(): number {
  return (
    containedReportWindows.size - Number(containedReportWindows.has(undefined))
  );
}

/** Release diagnostics owned by a tree, after its cleanup callbacks finish. */
export function releaseContainedReportBudget(treeId: TreeId): void {
  containedReportWindows.delete(treeId);
}
