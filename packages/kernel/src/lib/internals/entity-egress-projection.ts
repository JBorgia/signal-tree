import type { EntityProjectionSeedEntry } from './entity-projection-seed';
import {
  createEntityTopology,
  type EntityTopology,
  type StructuralEffect,
} from './source-mutation';

/**
 * ONE CONSUMER'S EGRESS-ELIGIBLE VIEW OF AN ENTITY COLLECTION.
 *
 * This holds AUTHORITY — which lifetimes this relationship may publish, in what
 * order, with which rows. It deliberately holds no source knowledge: how a
 * structural effect changes local topology, and where a subject sits relative
 * to others, belong to `source-mutation.ts`, which the serialization consumer
 * will share. Authority is never shared.
 *
 * The division that makes inspection safe:
 *
 *   LOCAL topology (source-mutation)   advanced by EVERY event, inspection
 *                                      included. Current, never historical.
 *   ELIGIBLE authority (here)          advanced only by authored work, plus the
 *                                      minimum adoption an authored operation
 *                                      needs to be representable.
 *
 * TRAVERSE, DON'T PROMOTE. Adopting a subject that only inspection created asks
 * the topology where it sits once non-eligible subjects are projected away.
 * `isEligible` is passed in as the predicate: the topology never learns what
 * authority means.
 *
 * ADOPTION IS SEMANTIC-MINIMUM, NOT ANY-TOUCH. An authored UPDATE of an
 * inspection-created subject adopts it, because the update cannot otherwise be
 * represented. An authored REMOVE of one does not — "still absent" already
 * represents it externally.
 */

type Key = string | number;

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
  /**
   * End of a delivery: place anything still held for neighbours that never
   * arrived. Returns true if the eligible value changed.
   */
  settle(): boolean;
  /**
   * A collection's complete committed order changed (15.4.4). Local order
   * always follows; eligible order follows only authored work. Returns true if
   * the eligible value changed.
   */
  reorder(after: readonly number[], inspection: boolean): boolean;
  /** Inbound external truth replaces authority and topology alike. */
  reseed(seed: readonly EntityProjectionSeedEntry<Key, unknown>[]): void;
};

export function createEntityEgressProjection(
  seed: readonly EntityProjectionSeedEntry<Key, unknown>[]
): EntityEgressProjection {
  let topology: EntityTopology = createEntityTopology(seed);

  let order: number[] = [];
  const rows = new Map<number, unknown>();
  const keyOf = new Map<number, Key>();

  function load(entries: readonly EntityProjectionSeedEntry<Key, unknown>[]) {
    order = [];
    rows.clear();
    keyOf.clear();
    for (const e of entries) {
      order.push(e.subjectId);
      rows.set(e.subjectId, e.row);
      keyOf.set(e.subjectId, e.key);
    }
  }
  load(seed);

  const isEligible = (s: number) => rows.has(s);

  /**
   * Eligible subjects whose local position is not known yet: the topology is
   * holding them for neighbours later in the same delivery (15.4.4). They are
   * eligible, but take no slot in `order` until the topology places them.
   */
  const unplaced = new Set<number>();
  const isPositioned = (s: number) => rows.has(s) && !unplaced.has(s);

  function place(subject: number) {
    if (order.includes(subject)) return;
    if (topology.isHeld(subject)) {
      unplaced.add(subject);
      return;
    }
    unplaced.delete(subject);
    const at = topology.placement(subject, isPositioned);
    if (at === 'end') return void order.push(subject);
    if ('after' in at) return void order.splice(order.indexOf(at.after) + 1, 0, subject);
    order.splice(order.indexOf(at.before), 0, subject);
  }

  /** Place every unplaced subject the topology has released since. */
  function placeReady(): boolean {
    const released = topology.takeReleased();
    if (unplaced.size === 0) return false;
    let changed = false;
    for (const subject of released) {
      if (!unplaced.has(subject)) continue;
      place(subject);
      changed = true;
    }
    return changed;
  }

  function remove(subject: number) {
    const i = order.indexOf(subject);
    if (i !== -1) order.splice(i, 1);
    rows.delete(subject);
    keyOf.delete(subject);
    unplaced.delete(subject);
  }

  /**
   * An authored add needs its address. If an eligible subject still holds that
   * address but is gone from local topology, its removal was an inspection
   * change this authored operation depends on — promote exactly that. Two live
   * subjects at one address is a collection the library itself refuses.
   */
  function reconcileAddress(key: Key | undefined, incoming: number) {
    if (key === undefined) return;
    for (const [subject, held] of keyOf) {
      if (held !== key || subject === incoming) continue;
      if (!topology.has(subject)) remove(subject);
      return;
    }
  }

  return {
    value: () => order.map((s) => rows.get(s)),

    reseed(entries) {
      topology = createEntityTopology(entries);
      unplaced.clear();
      load(entries);
    },

    settle() {
      topology.settle();
      let changed = placeReady();
      // Still unplaced: its topology hold ended without a position (an
      // inspection removal, or a reorder that no longer names it). Authority
      // is not revoked by either, so it is still published, at the end.
      for (const subject of [...unplaced]) {
        place(subject);
        changed = true;
      }
      return changed;
    },

    reorder(after, inspection) {
      // Local topology tracks reality, whoever reordered it.
      topology.reorder(after);
      const completed = placeReady();
      // An inspection reorder acquires no external-order authority.
      if (inspection) return completed;
      // Permute only the slots of eligible subjects the new order names. A
      // subject inspection removed keeps its slot, and one only inspection
      // created stays out: reordering grants no membership either way.
      const named = new Set(after);
      const positioned = new Set(order);
      const next = after.filter((subject) => positioned.has(subject));
      let cursor = 0;
      let changed = false;
      order = order.map((subject) => {
        if (!named.has(subject)) return subject;
        const moved = next[cursor++];
        if (moved !== subject) changed = true;
        return moved;
      });
      return changed || completed;
    },

    apply(subjectId, row, effect, inspection) {
      // Local topology tracks reality, whoever wrote it.
      if (effect) topology.observe(effect);
      // A held neighbour landing completes an AUTHORED placement deferred
      // earlier in this delivery, whoever authored the neighbour. Position is
      // still found by traversal, so nothing inspection created is promoted.
      const completed = placeReady();

      // Inspection stops here. It has said where things now sit; it has not
      // acquired the right to publish anything.
      if (inspection) return completed;

      if (effect?.kind === 'add') {
        reconcileAddress(effect.key, effect.subject);
        place(effect.subject);
        rows.set(effect.subject, effect.value);
        if (effect.key !== undefined) keyOf.set(effect.subject, effect.key);
        return true;
      }

      if (effect?.kind === 'remove') {
        if (!isEligible(effect.subject)) return completed;
        remove(effect.subject);
        return true;
      }

      if (effect?.kind === 'rekey') {
        // Address moves; lifetime, payload and order do not. A collection key
        // is not part of the `Row[]` this relationship publishes.
        if (!isEligible(effect.subject)) return completed;
        if (effect.afterKey !== undefined) keyOf.set(effect.subject, effect.afterKey);
        return true;
      }

      if (subjectId === undefined) return completed;
      if (!isEligible(subjectId)) {
        if (!topology.has(subjectId)) return completed;
        const k = topology.keyOf(subjectId);
        reconcileAddress(k, subjectId);
        place(subjectId);
        if (k !== undefined) keyOf.set(subjectId, k);
      }
      rows.set(subjectId, row);
      return true;
    },
  };
}
