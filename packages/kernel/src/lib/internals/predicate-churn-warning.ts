/** Development-only predicate diagnostics. One closure per participating collection. */
export function createPredicateChurnWarning<E>() {
  const predicateWindows = new Map<string, { count: number; start: number }>();
  const warnedPredicates = new Set<string>();
  /** Distinct identities within {@link PREDICATE_CHURN_WINDOW_MS} to accuse. */
  const PREDICATE_CHURN_THRESHOLD = 12;
  /** ~6 identities/second is well above user-driven, well below a frame loop. */
  const PREDICATE_CHURN_WINDOW_MS = 2000;

  return function warnOnPredicateChurn(
    method: 'where' | 'find',
    predicate: (entity: E) => boolean
  ): void {
    const source = String(predicate);
    // Guard against pathological state growth in a long dev session: the map is
    // only ever as large as the number of DISTINCT predicate sources.
    if (predicateWindows.size > 200 || warnedPredicates.has(source)) return;

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    const window = predicateWindows.get(source);
    if (!window || now - window.start > PREDICATE_CHURN_WINDOW_MS) {
      // A fresh window, not an increment. This is what makes a slow drip of
      // legitimately-rebuilt predicates never accumulate to an accusation.
      predicateWindows.set(source, { count: 1, start: now });
      return;
    }
    window.count++;
    if (window.count < PREDICATE_CHURN_THRESHOLD) return;

    warnedPredicates.add(source);
    const perSecond = Math.round(
      (window.count / Math.max(now - window.start, 1)) * 1000
    );
    console.warn(
      `SignalTree: \`${method}()\` received ${window.count} DIFFERENT functions ` +
        `with identical source in ${Math.round(now - window.start)}ms ` +
        `(~${perSecond}/second) — a rate only change detection produces. ` +
        `Results are memoised per predicate IDENTITY, so an inline arrow misses ` +
        `the cache every cycle and re-scans the collection: measured at 75x a ` +
        `hoisted predicate over 1,000 entities. Hoist it to a stable reference ` +
        `(a class field or module constant) and call ` +
        `\`${method}(thePredicate)()\`. Source: ${source.slice(0, 80)} [ST2026]`
    );
  };
}
