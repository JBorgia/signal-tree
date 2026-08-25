import type { EntityProjectionSeedEntry } from './entity-projection-seed';

/**
 * THE EGRESS-ELIGIBLE PROJECTION OF AN ENTITY COLLECTION.
 *
 * Scalar and branch projections answer "what VALUE may be published". A
 * collection must also answer "which LIFETIMES exist, in what ORDER, at which
 * ADDRESSES" — and inspection changes all three locally without acquiring any
 * authority. So two topologies are maintained, not one:
 *
 *   LOCAL      what the tree currently holds. Advanced by EVERY event,
 *              inspection included. Bounded by the collection's current size.
 *   ELIGIBLE   what this relationship may publish. Advanced only by authored
 *              work, plus the minimum adoption an authored operation needs.
 *
 * ⚠️ THIS IS NOT A HISTORY. Nothing here retains past operations. An inspection
 * subject exists in LOCAL only while it is currently in the collection, and
 * vanishes when it is removed. Retention is O(current subjects), never
 * O(operations). That boundary is the whole reason this fits in a consumer's
 * projection instead of becoming a replay engine.
 *
 * ⚠️ TRAVERSE, DON'T PROMOTE. When authored work adopts a subject that only
 * inspection created, its position is found by projecting LOCAL order onto the
 * eligible set: walk outward from the subject through LOCAL order until an
 * ELIGIBLE neighbour is found. Intermediate non-eligible subjects are stepped
 * OVER, never adopted.
 *
 *   local     [S1, S2, S3]      S2 and S3 created by inspection
 *   eligible  [S1]
 *   authored  update S3
 *   result    [S1, S3]          — S2 is a positional intermediate, not authority
 *
 * Promoting the traversed chain instead would publish S2, which no authored
 * work ever asked for. A structural reference is not a causal dependency.
 *
 * ORDERING VOCABULARY is measured, not inferred from the names
 * (`entity-order-carrier.spec.ts`): `beforeSubject` is the PREDECESSOR and
 * `afterSubject` the SUCCESSOR.
 *
 * DELIVERY ORDER IS NOT PROGRAM ORDER — measured in C3 and C4. Every decision
 * here reads current topology rather than assuming a callback sequence.
 */

type Key = string | number;

type StructuralEffect = {
  readonly kind: 'add' | 'remove' | 'rekey';
  readonly subject: number;
  readonly key?: Key;
  readonly value?: unknown;
  readonly beforeSubject?: number;
  readonly afterSubject?: number;
  readonly beforeKey?: Key;
  readonly afterKey?: Key;
};

export type EntityEgressProjection = {
  /** The complete eligible `Row[]`, in eligible order. */
  value(): readonly unknown[];
  /** Apply one notification. Returns true if eligible authority advanced. */
  apply(
    subjectId: number | undefined,
    row: unknown,
    effect: StructuralEffect | undefined,
    inspection: boolean
  ): boolean;
  /** Inbound external truth replaces both topologies wholesale. */
  reseed(seed: readonly EntityProjectionSeedEntry<Key, unknown>[]): void;
};

export function createEntityEgressProjection(
  seed: readonly EntityProjectionSeedEntry<Key, unknown>[]
): EntityEgressProjection {
  let localOrder: number[] = [];
  const localKey = new Map<number, Key>();

  let order: number[] = [];
  const rows = new Map<number, unknown>();
  const keyOf = new Map<number, Key>();

  function load(entries: readonly EntityProjectionSeedEntry<Key, unknown>[]) {
    localOrder = [];
    order = [];
    localKey.clear();
    rows.clear();
    keyOf.clear();
    for (const e of entries) {
      localOrder.push(e.subjectId);
      localKey.set(e.subjectId, e.key);
      order.push(e.subjectId);
      rows.set(e.subjectId, e.row);
      keyOf.set(e.subjectId, e.key);
    }
  }
  load(seed);

  // ── LOCAL topology: every event, inspection included ─────────────────────
  function localAdd(e: StructuralEffect) {
    if (localOrder.includes(e.subject)) return;
    if (e.key !== undefined) localKey.set(e.subject, e.key);
    if (e.beforeSubject !== undefined) {
      const i = localOrder.indexOf(e.beforeSubject);
      if (i !== -1) return void localOrder.splice(i + 1, 0, e.subject);
    }
    if (e.afterSubject !== undefined) {
      const i = localOrder.indexOf(e.afterSubject);
      if (i !== -1) return void localOrder.splice(i, 0, e.subject);
    }
    localOrder.push(e.subject);
  }

  function localRemove(subject: number) {
    const i = localOrder.indexOf(subject);
    if (i !== -1) localOrder.splice(i, 1);
    localKey.delete(subject);
  }

  // ── ELIGIBLE topology ────────────────────────────────────────────────────
  const isEligible = (s: number) => rows.has(s);

  /**
   * Project LOCAL order onto the eligible set to position `subject`: step
   * outward through local order until an eligible neighbour appears. The
   * subjects stepped over are positional intermediates and stay excluded.
   */
  function placeByLocalTopology(subject: number) {
    if (order.includes(subject)) return;
    const at = localOrder.indexOf(subject);
    if (at !== -1) {
      for (let j = at - 1; j >= 0; j--) {
        const cand = localOrder[j];
        if (isEligible(cand)) {
          return void order.splice(order.indexOf(cand) + 1, 0, subject);
        }
      }
      for (let j = at + 1; j < localOrder.length; j++) {
        const cand = localOrder[j];
        if (isEligible(cand)) {
          return void order.splice(order.indexOf(cand), 0, subject);
        }
      }
      // No eligible neighbour on either side: the eligible collection is empty
      // of anything this subject can anchor against.
      order.push(subject);
      return;
    }
    order.push(subject);
  }

  function eligibleRemove(subject: number) {
    const i = order.indexOf(subject);
    if (i !== -1) order.splice(i, 1);
    rows.delete(subject);
    keyOf.delete(subject);
  }

  /**
   * An authored add needs its address. If an ELIGIBLE subject still holds that
   * address but is no longer present LOCALLY, its removal was an inspection
   * change that this authored operation depends on — promote exactly that, and
   * nothing else. Two live subjects at one address is a collection the library
   * itself refuses to produce.
   */
  function reconcileAddress(key: Key | undefined, incoming: number) {
    if (key === undefined) return;
    for (const [subject, held] of keyOf) {
      if (held !== key || subject === incoming) continue;
      if (!localOrder.includes(subject)) eligibleRemove(subject);
      return;
    }
  }

  return {
    value: () => order.map((s) => rows.get(s)),

    reseed(entries) {
      load(entries);
    },

    apply(subjectId, row, effect, inspection) {
      // LOCAL topology tracks reality, whoever wrote it.
      if (effect?.kind === 'add') localAdd(effect);
      else if (effect?.kind === 'remove') localRemove(effect.subject);
      else if (effect?.kind === 'rekey' && effect.afterKey !== undefined) {
        localKey.set(effect.subject, effect.afterKey);
      }

      // Inspection stops here. It has told us where things now sit; it has not
      // acquired the right to publish anything.
      if (inspection) return false;

      if (effect?.kind === 'add') {
        reconcileAddress(effect.key, effect.subject);
        placeByLocalTopology(effect.subject);
        rows.set(effect.subject, effect.value);
        if (effect.key !== undefined) keyOf.set(effect.subject, effect.key);
        return true;
      }

      if (effect?.kind === 'remove') {
        // Removing a subject that was never eligible is externally
        // value-neutral: it continues not to exist. An authored TOUCH does not
        // imply adoption — only an operation that cannot be represented
        // without the subject does.
        if (!isEligible(effect.subject)) return false;
        eligibleRemove(effect.subject);
        return true;
      }

      if (effect?.kind === 'rekey') {
        // Address moves; lifetime, payload and order do not. The published
        // `Row[]` therefore does not change — a collection key is not part of
        // the value this relationship exchanges.
        if (!isEligible(effect.subject)) return false;
        if (effect.afterKey !== undefined) keyOf.set(effect.subject, effect.afterKey);
        return true;
      }

      // A plain row event carries the complete row for one subject.
      if (subjectId === undefined) return false;
      if (!isEligible(subjectId)) {
        // Authored work naming a subject that only inspection created: the
        // update cannot be represented unless the subject exists, so adopt it.
        if (!localOrder.includes(subjectId)) return false;
        reconcileAddress(localKey.get(subjectId), subjectId);
        placeByLocalTopology(subjectId);
        const k = localKey.get(subjectId);
        if (k !== undefined) keyOf.set(subjectId, k);
      }
      rows.set(subjectId, row);
      return true;
    },
  };
}
