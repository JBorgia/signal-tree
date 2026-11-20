/**
 * Store-time attribution: one User Timing measure per store turn, named
 * `signal-tree:turn` with the turn's label as its detail, recorded only in
 * bench builds.
 *
 * Bench builds define __SIGNAL_TREE_BENCH__ as true. Production builds must
 * define it as false, so the minifier drops every guarded block and with it
 * both the identifier and the `signal-tree:` names. Leaving it undefined is
 * not enough: the `typeof` guard then stays in the bundle, the identifier
 * with it, and the production symbol scan rejects the bundle.
 * (test/bench-flag.test.ts bundles this module both ways.)
 */
declare const __SIGNAL_TREE_BENCH__: boolean | undefined;

/** The last duration of each label, so readers never scan the performance timeline (bench builds only). */
let lastByLabel: Map<string, number> | undefined;

/**
 * Runs `fn` as one measured turn. `lazyReads`, when given, runs inside the
 * same measure after `fn`, so reads the adapter would otherwise do lazily
 * (pulled later by change detection) are charged to the store (#12).
 * The harness consumes and clears the measures (runner/browser.ts drainPerf).
 */
export function measuredTurn(label: string, fn: () => void, lazyReads?: () => void): void {
  if (typeof __SIGNAL_TREE_BENCH__ !== 'undefined' && __SIGNAL_TREE_BENCH__) {
    const start = performance.now();
    try {
      fn();
      lazyReads?.();
    } finally {
      const end = performance.now();
      (lastByLabel ??= new Map()).set(label, end - start);
      performance.measure('signal-tree:turn', { start, end, detail: label });
    }
    return;
  }
  fn();
}

/** Duration of the most recent turn labelled `label` (NaN outside bench builds). */
export function lastTurnMs(label: string): number {
  if (typeof __SIGNAL_TREE_BENCH__ !== 'undefined' && __SIGNAL_TREE_BENCH__) return lastByLabel?.get(label) ?? Number.NaN;
  return Number.NaN;
}
