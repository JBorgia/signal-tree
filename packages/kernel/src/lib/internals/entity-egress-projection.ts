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

/** Undefined evidence cannot authorize adopting a captured whole row. */
export function projectEntityFields(
  previous: unknown,
  row: unknown,
  fields: readonly string[] | null | undefined
): unknown {
  if (fields === null) return row;
  if (!fields?.length || !row || typeof row !== 'object') return previous;
  const next = { ...(previous as Record<string, unknown>) };
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      Object.defineProperty(next, key, {
        value: (row as Record<string, unknown>)[key],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } else delete next[key];
  }
  return next;
}

export type EntityEgressProjection = {
  /** The complete eligible `Row[]`, in eligible order. */
  value(): readonly unknown[];
  /** Advance local order; only authored order may advance eligible authority. */
  reorder(afterSubjects: readonly number[], inspection: boolean): boolean;
  /** Apply one notification. Returns true if eligible authority advanced. */
  apply(
    subjectId: number | undefined,
    row: unknown,
    effect: StructuralEffect | undefined,
    inspection: boolean,
    fields?: readonly string[] | null
  ): boolean;
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

  function place(subject: number) {
    if (order.includes(subject)) return;
    const at = topology.placement(subject, isEligible);
    if (at === 'end') return void order.push(subject);
    if ('after' in at)
      return void order.splice(order.indexOf(at.after) + 1, 0, subject);
    order.splice(order.indexOf(at.before), 0, subject);
  }

  function remove(subject: number) {
    const i = order.indexOf(subject);
    if (i !== -1) order.splice(i, 1);
    rows.delete(subject);
    keyOf.delete(subject);
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

    reorder(afterSubjects, inspection) {
      topology.reorder(afterSubjects);
      if (inspection) return false;
      const present = new Set(afterSubjects);
      const eligible = afterSubjects.filter(isEligible);
      let cursor = 0;
      let changed = false;
      // Inspection may have removed a still-eligible lifetime. Reordering the
      // live subset does not authorize deleting or adopting any lifetime.
      order = order.map((subject) => {
        if (!present.has(subject)) return subject;
        const next = eligible[cursor++];
        if (next !== subject) changed = true;
        return next;
      });
      return changed;
    },

    reseed(entries) {
      topology = createEntityTopology(entries);
      load(entries);
    },

    apply(subjectId, row, effect, inspection, fields) {
      // Local topology tracks reality, whoever wrote it.
      if (effect) topology.observe(effect);

      // Inspection stops here. It has said where things now sit; it has not
      // acquired the right to publish anything.
      if (inspection) return false;

      if (effect?.kind === 'add') {
        reconcileAddress(effect.key, effect.subject);
        place(effect.subject);
        rows.set(effect.subject, effect.value);
        if (effect.key !== undefined) keyOf.set(effect.subject, effect.key);
        return true;
      }

      if (effect?.kind === 'remove') {
        if (!isEligible(effect.subject)) return false;
        remove(effect.subject);
        return true;
      }

      if (effect?.kind === 'rekey') {
        // Address moves; lifetime, payload and order do not. A collection key
        // is not part of the `Row[]` this relationship publishes.
        if (!isEligible(effect.subject)) return false;
        if (effect.afterKey !== undefined)
          keyOf.set(effect.subject, effect.afterKey);
        return true;
      }

      if (subjectId === undefined) return false;
      if (isEligible(subjectId)) {
        const previous = rows.get(subjectId);
        const next = projectEntityFields(previous, row, fields);
        if (next === previous) return false;
        rows.set(subjectId, next);
        return true;
      }
      if (fields === undefined) return false;
      if (!isEligible(subjectId)) {
        if (!topology.has(subjectId)) return false;
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
