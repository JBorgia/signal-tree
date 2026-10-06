import type { EntityProjectionSeedEntry } from './entity-projection-seed';

/**
 * SOURCE-SHAPE INTERPRETATION — shared; authority is NOT.
 *
 * Two consumers now need to understand what a causal notification MEANS for a
 * given source shape: `link()`, and the serialization enhancer's whole-tree
 * durable projection. They do NOT share what they consider eligible — each owns
 * its own authority state, baseline and lifecycle.
 *
 *   SHARE INTERPRETATION. DO NOT SHARE AUTHORITY.
 *
 * So this module answers "what happened to this source, and where do things
 * sit". It never answers "may this consumer publish it" — that requires the
 * caller's own eligibility, which arrives here only as a PREDICATE.
 *
 * ⚠️ REPRESENTATION STAYS NATIVE. Scalars, branches and entity collections are
 * deliberately not normalized into one patch-record type. Flattening them was
 * the original defect: a branch path reducer applied to an `EntitySignal` whose
 * NaturalValue is `Row[]` indexes an array by key. Uniformity belongs at the
 * protocol level, not in the payload.
 */

type Key = string | number;

// ═══════════════════════════════════════════════════════════════════════════
// SCALAR / BRANCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Immutably apply one leaf value onto a previous complete value.
 *
 * Deliberately NOT a re-read of current state: re-reading after a notification
 * is how inspection contamination re-enters, because batched delivery means a
 * later inspection write is already applied by the time an eligible one is
 * observed.
 *
 * INTERNAL reconstruction only — no consumer's public boundary becomes a patch
 * protocol because of this.
 */
export function applyAtSegments<T>(
  previous: T,
  segments: readonly string[],
  value: unknown
): T {
  return setAtPath(previous, segments, value) as T;
}

function setAtPath(
  node: unknown,
  segments: readonly string[],
  value: unknown
): unknown {
  if (segments.length === 0) return value;
  const [head, ...rest] = segments;
  const base = (node ?? {}) as Record<string, unknown>;
  return { ...base, [head]: setAtPath(base[head], rest, value) };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTITY COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════

export type StructuralEffect = {
  readonly kind: 'add' | 'remove' | 'rekey';
  readonly subject: number;
  readonly key?: Key;
  readonly value?: unknown;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
  readonly beforeKey?: Key;
  readonly afterKey?: Key;
};

/**
 * CURRENT local topology of an entity collection. Current, not historical:
 * a subject exists here only while it is currently in the collection, so
 * retention is O(current subjects) and never O(operations). Nothing in this
 * type is a journal, a replay log, or a causal graph.
 */
export type EntityTopology = {
  /** Advance to reflect one structural effect, whoever authored it. */
  observe(effect: StructuralEffect): void;
  /** The current address of a subject, which a row payload cannot supply. */
  keyOf(subject: number): Key | undefined;
  /** Is this subject currently present locally at all? */
  has(subject: number): boolean;
  /**
   * Does this present subject have a known local position? False while an
   * added subject is HELD for neighbours that have not arrived yet.
   */
  placed(subject: number): boolean;
  /**
   * Give every held subject a position now, as if its missing neighbours will
   * never arrive. Call once the notifications of a delivery have all been
   * observed. Returns true if anything was held.
   */
  settle(): boolean;
  /**
   * Where would `subject` sit if every subject failing `isIncluded` were
   * projected away? Walks outward through CURRENT local order and returns the
   * nearest included neighbour on either side.
   *
   * ⚠️ TRAVERSE, DON'T PROMOTE. Subjects stepped over are positional
   * intermediates. Inclusion is the CALLER's notion — this module has no
   * opinion about authority, and must not acquire one.
   */
  placement(
    subject: number,
    isIncluded: (subject: number) => boolean
  ): { after: number } | { before: number } | 'end';
  /** Replace the whole topology, e.g. after inbound external truth lands. */
  reload(seed: readonly EntityProjectionSeedEntry<Key, unknown>[]): void;
};

/**
 * ⚠️ NEIGHBOURS NAME THE FINAL ORDER, NOT THE ARRIVAL ORDER (15.4.4).
 *
 * An add carries the neighbours its subject has once the WHOLE operation has
 * applied: `setAll()` and every reversal describe each added row against the
 * target order, and a reversal publishes restored rows in lifetime-id order.
 * Restoring A and B at the head of ABCD therefore arrives as
 * `add A pred=- succ=B` while B is still absent. Placing only beside a
 * neighbour that is already present, and appending otherwise, sent CDAB to a
 * Link endpoint while the tree held ABCD.
 *
 * So an add is placed by the first rule that applies:
 *
 *   predecessor present     after it
 *   successor present       before it
 *   no predecessor          at the head — nothing precedes it in its order
 *   no successor            at the tail
 *   otherwise               HELD until either neighbour lands, then placed
 *                           beside it, and so on along the chain
 *
 * A neighbour that is removed before its own add is observed (same-tick
 * notifications fold an add into a later removal of the same row) can never
 * land. Its removal names the neighbours it had, so a subject held on it moves
 * its anchor across to them. `settle()` is the last resort for anything still
 * held once a delivery is complete: it appends, which was the previous rule
 * for every unplaceable add.
 */
type Anchors = { pred?: number; succ?: number };

export function createEntityTopology(
  seed: readonly EntityProjectionSeedEntry<Key, unknown>[]
): EntityTopology {
  let order: number[] = [];
  const keys = new Map<number, Key>();
  // Held subjects, and the reverse index from an absent anchor to them.
  const held = new Map<number, Anchors>();
  const heldOn = new Map<number, Set<number>>();

  const index = (anchor: number | undefined, subject: number) => {
    if (anchor === undefined) return;
    let waiting = heldOn.get(anchor);
    if (!waiting) heldOn.set(anchor, (waiting = new Set()));
    waiting.add(subject);
  };
  const unindex = (anchor: number | undefined, subject: number) => {
    if (anchor === undefined) return;
    const waiting = heldOn.get(anchor);
    waiting?.delete(subject);
    if (waiting?.size === 0) heldOn.delete(anchor);
  };
  const release = (subject: number) => {
    const anchors = held.get(subject);
    if (!anchors) return;
    held.delete(subject);
    unindex(anchors.pred, subject);
    unindex(anchors.succ, subject);
  };

  /** Place `first`, then every held subject that was waiting on it. */
  const placeFrom = (first: number, at: number) => {
    order.splice(at, 0, first);
    const placed = [first];
    while (placed.length > 0) {
      const anchor = placed.pop() as number;
      for (const subject of [...(heldOn.get(anchor) ?? [])]) {
        const anchors = held.get(subject) as Anchors;
        release(subject);
        const i = order.indexOf(anchor);
        order.splice(anchors.pred === anchor ? i + 1 : i, 0, subject);
        placed.push(subject);
      }
    }
  };

  /** The position an add's neighbours give it, or -1 to hold it. */
  const positionFor = ({ pred, succ }: Anchors): number => {
    if (pred !== undefined) {
      const i = order.indexOf(pred);
      if (i !== -1) return i + 1;
    }
    if (succ !== undefined) {
      const i = order.indexOf(succ);
      if (i !== -1) return i;
    }
    if (pred === undefined && succ !== undefined) return 0;
    if (succ === undefined) return order.length;
    return -1;
  };

  function reload(entries: readonly EntityProjectionSeedEntry<Key, unknown>[]) {
    order = [];
    keys.clear();
    held.clear();
    heldOn.clear();
    for (const e of entries) {
      order.push(e.subjectId);
      keys.set(e.subjectId, e.key);
    }
  }
  reload(seed);

  return {
    reload,
    keyOf: (subject) => keys.get(subject),
    has: (subject) => held.has(subject) || order.includes(subject),
    placed: (subject) => order.includes(subject),

    settle() {
      if (held.size === 0) return false;
      for (const subject of [...held.keys()]) {
        if (!held.has(subject)) continue;
        release(subject);
        placeFrom(subject, order.length);
      }
      return true;
    },

    observe(effect) {
      if (effect.kind === 'add') {
        if (effect.key !== undefined) keys.set(effect.subject, effect.key);
        if (held.has(effect.subject) || order.includes(effect.subject)) return;
        // `beforeSubject` is the PREDECESSOR and `afterSubject` the SUCCESSOR —
        // measured, not read off the names (`entity-order-carrier.spec.ts`).
        const anchors = {
          pred: effect.beforeSubject,
          succ: effect.afterSubject,
        };
        const at = positionFor(anchors);
        if (at !== -1) return placeFrom(effect.subject, at);
        held.set(effect.subject, anchors);
        index(anchors.pred, effect.subject);
        index(anchors.succ, effect.subject);
        return;
      }
      if (effect.kind === 'remove') {
        const i = order.indexOf(effect.subject);
        if (i !== -1) order.splice(i, 1);
        release(effect.subject);
        keys.delete(effect.subject);
        // A neighbour removed before it ever landed: re-anchor across it.
        const waiting = heldOn.get(effect.subject);
        if (i === -1 && waiting) {
          for (const subject of [...waiting]) {
            const anchors = held.get(subject) as Anchors;
            release(subject);
            const next = {
              pred:
                anchors.pred === effect.subject
                  ? effect.beforeSubject
                  : anchors.pred,
              succ:
                anchors.succ === effect.subject
                  ? effect.afterSubject
                  : anchors.succ,
            };
            const at = positionFor(next);
            if (at !== -1) {
              placeFrom(subject, at);
              continue;
            }
            held.set(subject, next);
            index(next.pred, subject);
            index(next.succ, subject);
          }
        }
        return;
      }
      if (effect.afterKey !== undefined)
        keys.set(effect.subject, effect.afterKey);
    },

    placement(subject, isIncluded) {
      const at = order.indexOf(subject);
      if (at !== -1) {
        for (let j = at - 1; j >= 0; j--) {
          if (isIncluded(order[j])) return { after: order[j] };
        }
        for (let j = at + 1; j < order.length; j++) {
          if (isIncluded(order[j])) return { before: order[j] };
        }
      }
      return 'end';
    },
  };
}
