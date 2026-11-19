/**
 * Store-time attribution (ruling 7): one User Timing measure per store turn,
 * named with the `signal-tree:` prefix, only when the bench build defines
 * __SIGNAL_TREE_BENCH__ as true. Production builds define it false (or leave
 * it undefined) so the measure and its name drop out of the bundle.
 */
declare const __SIGNAL_TREE_BENCH__: boolean | undefined;

export function measuredTurn(label: string, fn: () => void): void {
  if (typeof __SIGNAL_TREE_BENCH__ !== 'undefined' && __SIGNAL_TREE_BENCH__) {
    const start = performance.now();
    try {
      fn();
    } finally {
      performance.measure('signal-tree:turn', { start, end: performance.now(), detail: label });
    }
    return;
  }
  fn();
}

/** Duration of the most recent turn measure labelled `label` (NaN outside bench builds). */
export function lastTurnMs(label: string): number {
  if (typeof __SIGNAL_TREE_BENCH__ !== 'undefined' && __SIGNAL_TREE_BENCH__) {
    const entries = performance.getEntriesByName('signal-tree:turn') as PerformanceMeasure[];
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i]!.detail === label) return entries[i]!.duration;
  }
  return Number.NaN;
}
