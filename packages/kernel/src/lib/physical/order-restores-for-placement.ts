const rowScope = (owner: unknown, subject: unknown): string =>
  `${String(owner)}\u0000${String(subject)}`;

/**
 * Orders a frame's restores so each one, when it commits, finds its recorded
 * neighbours live. Restores commit in sequence and each resolves its anchors
 * against the rows live at that moment, so the order decides the placement.
 * Capture order cannot be used: the notifier delivers a row's removal in the
 * slot of that row's EARLIER write, so `updateOne('a'); clear()` reversed
 * restored [a, c, z].
 *
 * Next is, in order of preference: a restore whose restored anchors are all
 * placed and that has a live anchor (or no live-able anchor at all); one with
 * at least one live anchor while another is still waiting; else the head of a
 * chain with nothing live (one whose predecessor is not waiting). An anchor
 * that is a surviving row, or a restore already placed, is live. The tiers
 * matter both ways: `updateOne c; removeOne a; removeOne c` anchors a to c (c
 * was there when a went), so c goes first; `removeMany([z, a])` beside a
 * surviving c anchors z and a to each other, so a goes first, against c.
 */
export function orderRestoresForPlacement<
  T extends { owner: unknown; subjectId: number }
>(
  restores: readonly T[],
  anchorsOf: (
    effect: T
  ) => { beforeSubject?: number; afterSubject?: number } | undefined,
  isLive: (effect: T, subject: number) => boolean
): T[] {
  if (restores.length < 2) return [...restores];
  const pending = new Map<string, T>();
  for (const effect of restores) {
    pending.set(rowScope(effect.owner, effect.subjectId), effect);
  }
  const waiting = new Map<T, number>();
  const hasLiveAnchor = new Set<T>();
  const dependents = new Map<string, T[]>();
  const full: T[] = [];
  const partial: T[] = [];
  // A pending predecessor that becomes placed queues its dependent below.
  // Only initial nonpending-predecessor heads can win a later empty-queue
  // fallback; index them during the existing anchor pass instead of rescanning.
  const heads: T[] = [];
  for (const effect of restores) {
    const anchors = anchorsOf(effect);
    if (anchors?.beforeSubject === undefined ||
        !pending.has(rowScope(effect.owner, anchors.beforeSubject))) heads.push(effect);
    let count = 0;
    for (const subject of [anchors?.beforeSubject, anchors?.afterSubject]) {
      if (subject === undefined) continue;
      const key = rowScope(effect.owner, subject);
      if (pending.has(key)) {
        count += 1;
        const list = dependents.get(key);
        if (list) list.push(effect);
        else dependents.set(key, [effect]);
      } else if (isLive(effect, subject)) {
        hasLiveAnchor.add(effect);
      }
    }
    waiting.set(effect, count);
    if (count === 0) full.push(effect);
    else if (hasLiveAnchor.has(effect)) partial.push(effect);
  }
  const placed = new Set<T>();
  const ordered: T[] = [];
  let fullHead = 0;
  let partialHead = 0;
  let headCursor = 0;
  // Stable input order remains the tie-breaker when a component is cyclic.
  let cycleCursor = 0;
  while (ordered.length < restores.length) {
    while (fullHead < full.length && placed.has(full[fullHead])) fullHead += 1;
    while (partialHead < partial.length && placed.has(partial[partialHead])) {
      partialHead += 1;
    }
    while (headCursor < heads.length && placed.has(heads[headCursor])) headCursor++;
    while (cycleCursor < restores.length && placed.has(restores[cycleCursor])) cycleCursor++;
    const next =
      fullHead < full.length
        ? full[fullHead++]
        : partialHead < partial.length
        ? partial[partialHead++]
        : headCursor < heads.length
        ? heads[headCursor++]
        : restores[cycleCursor++];
    placed.add(next);
    ordered.push(next);
    for (const dependent of dependents.get(
      rowScope(next.owner, next.subjectId)
    ) ?? []) {
      if (placed.has(dependent)) continue;
      const left = (waiting.get(dependent) ?? 1) - 1;
      waiting.set(dependent, left);
      hasLiveAnchor.add(dependent);
      if (left === 0) full.push(dependent);
      else partial.push(dependent);
    }
  }
  return ordered;
}

