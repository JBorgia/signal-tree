/**
 * Rows a turn created AND removed ("transient" rows).
 *
 * A turn's capture composes a creation followed by a removal of the same row
 * into nothing: the row exists at neither end of the turn. But other rows'
 * recorded neighbours can be that row (`addOne x0; removeOne e; addOne x1;
 * removeOne x0` anchors x1 after x0), and with it gone their place was
 * unknown: redo threw "no live placement anchor". Its field writes were left
 * behind too, naming a lifetime that never exists at either end ("Value
 * effect has no active subject").
 *
 * So the capture remembers each transient row's creation and removal here,
 * and a turn keeps it as a value-less GHOST pair (its add, then its remove)
 * only when a kept row's neighbour is it, directly or through other ghosts.
 * A reversal inserts a ghost and deletes it again within one transition,
 * which only the declarative path can do without publishing it. Both halves
 * carry ONE key, so `requiresDeclarativeStructuralTarget` always sees a key
 * handoff and routes the frame there (reversal-order.spec.ts checks a ghost is
 * never published). Its field writes are dropped.
 */
type AnchoredRowEffect = {
  readonly kind: 'add' | 'remove';
  readonly position: number;
  readonly ownerPath: string;
  readonly path: string;
  readonly subject: number;
  readonly key: string | number;
  readonly value: unknown;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
};

type TransientRow = { add: AnchoredRowEffect; remove: AnchoredRowEffect };

const transients = new WeakMap<object, Map<string, TransientRow>>();

const rowOf = (position: number, subject: number) =>
  `${position}\u0000${subject}`;

/** Record that `add` and `remove` composed away in `capture`. */
export function rememberTransientRow(
  capture: object,
  add: AnchoredRowEffect,
  remove: AnchoredRowEffect
): void {
  let rows = transients.get(capture);
  if (!rows) {
    rows = new Map();
    transients.set(capture, rows);
  }
  rows.set(rowOf(add.position, add.subject), { add, remove });
}

export function forgetTransientRows(capture: object): void {
  transients.delete(capture);
}

/**
 * The turn's effects with its transient rows applied: field writes to them
 * dropped, and a ghost pair appended for each one a kept row (or another
 * needed ghost) names as a neighbour.
 */
export function withTransientRows<
  E extends {
    readonly kind: string;
    readonly position: number;
    readonly subject?: number;
  }
>(effects: E[], capture: object): E[] {
  const rows = transients.get(capture);
  if (!rows || rows.size === 0) return effects;
  const kept = effects.filter(
    (effect) =>
      effect.kind !== 'set' ||
      effect.subject === undefined ||
      !rows.has(rowOf(effect.position, effect.subject))
  );
  const needed = new Set<string>();
  const queue: string[] = [];
  const visit = (position: number, subject: number | undefined): void => {
    if (subject === undefined) return;
    const row = rowOf(position, subject);
    if (!rows.has(row) || needed.has(row)) return;
    needed.add(row);
    queue.push(row);
  };
  for (const effect of kept) {
    if (effect.kind !== 'add' && effect.kind !== 'remove') continue;
    const anchored = effect as unknown as AnchoredRowEffect;
    visit(anchored.position, anchored.beforeSubject);
    visit(anchored.position, anchored.afterSubject);
  }
  while (queue.length > 0) {
    const row = rows.get(queue.pop() as string) as TransientRow;
    for (const side of [row.add, row.remove]) {
      visit(side.position, side.beforeSubject);
      visit(side.position, side.afterSubject);
    }
  }
  if (needed.size === 0) return kept;
  const ghosts: E[] = [];
  for (const [row, { add, remove }] of rows) {
    if (!needed.has(row)) continue;
    // Both halves under the key it was removed at (a rename in between moved
    // the creation's key); no values: a ghost is never installed.
    ghosts.push(
      { ...add, key: remove.key, value: undefined } as unknown as E,
      { ...remove, value: undefined } as unknown as E
    );
  }
  return [...kept, ...ghosts];
}
