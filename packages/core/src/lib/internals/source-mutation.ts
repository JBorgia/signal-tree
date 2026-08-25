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
export function applyAtRelativePath<T>(
  previous: T,
  ownerPath: string,
  path: string,
  value: unknown
): T {
  // A whole-source notification already carries the complete value: the scalar
  // case, where `path === ownerPath`.
  if (path === ownerPath) return value as T;
  const relative = ownerPath === '' ? path : path.slice(ownerPath.length + 1);
  return setAtPath(previous, relative.split('.'), value) as T;
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

export function createEntityTopology(
  seed: readonly EntityProjectionSeedEntry<Key, unknown>[]
): EntityTopology {
  let order: number[] = [];
  const keys = new Map<number, Key>();

  function reload(entries: readonly EntityProjectionSeedEntry<Key, unknown>[]) {
    order = [];
    keys.clear();
    for (const e of entries) {
      order.push(e.subjectId);
      keys.set(e.subjectId, e.key);
    }
  }
  reload(seed);

  return {
    reload,
    keyOf: (subject) => keys.get(subject),
    has: (subject) => order.includes(subject),

    observe(effect) {
      if (effect.kind === 'add') {
        if (order.includes(effect.subject)) return;
        if (effect.key !== undefined) keys.set(effect.subject, effect.key);
        // `beforeSubject` is the PREDECESSOR and `afterSubject` the SUCCESSOR —
        // measured, not read off the names (`entity-order-carrier.spec.ts`).
        if (effect.beforeSubject !== undefined) {
          const i = order.indexOf(effect.beforeSubject);
          if (i !== -1) return void order.splice(i + 1, 0, effect.subject);
        }
        if (effect.afterSubject !== undefined) {
          const i = order.indexOf(effect.afterSubject);
          if (i !== -1) return void order.splice(i, 0, effect.subject);
        }
        order.push(effect.subject);
        return;
      }
      if (effect.kind === 'remove') {
        const i = order.indexOf(effect.subject);
        if (i !== -1) order.splice(i, 1);
        keys.delete(effect.subject);
        return;
      }
      if (effect.afterKey !== undefined) keys.set(effect.subject, effect.afterKey);
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
