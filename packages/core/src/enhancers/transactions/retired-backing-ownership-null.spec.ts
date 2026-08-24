import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../time-travel/time-travel';
import { transactions } from './transactions';

/**
 * STEP 8 PHASE 6B — THE OWNERSHIP NULL FOR RETIRED VALUE BACKING.
 *
 * The question was "during which transaction states does a retired subject's
 * physical backing remain necessary?" The answer turned out to be about
 * something narrower than transactions, so read the conclusion before the
 * tests.
 *
 * ## Method
 *
 * Get into a state, retire a subject, DELETE ITS VALUE BACKING through
 * `__retireSubjectRetainedValueBackingForTesting`, then perform every legal
 * operation and check the result. A state that survives does not own the
 * bytes.
 *
 * ## Result: NO state tested owns them, and the static reason is stronger
 * ## than the tests
 *
 * Every reader of `EntityValueStore.backingForSubject` is on the ACTIVE path:
 * `getProjectedEntity` resolves through `subjectIdForKey`, which a tombstone
 * has already deleted; `getEntitySignal` materialises for a live id;
 * `resolveEntityHandle` returns early unless `subject.state === 'active'`.
 *
 * The one apparent exception is a dead fallback. `prepareCommitInstructions`
 * computes `mutation.realizedValue ?? backingForSubject(subjectId)` for a
 * `restore-subject`, and the only construction site is `planRestore(key,
 * entity, subjectId, ...)`, whose `entity` is required and always becomes
 * `realizedValue`. So the `??` never evaluates its right side.
 *
 * A restorer holds its own copy either way: a time-travel entry carries the
 * state snapshot, a transaction turn carries `__baselineValues`, and a
 * structural `remove` effect carries `deepClone(entity)`. The entity layer's
 * retained value is a THIRD copy that nothing reads once the subject is
 * tombstoned.
 *
 * ## THE OTHER HALF: the lifetime record IS owned, for the PENDING interval
 *
 * Full production reclamation of a subject retired inside an unsettled turn
 * makes `rollback()` throw `could not rollback the pending transaction` and
 * loses the row permanently. The control restores it. So `transactions()` owns
 * restoration of a subject from the optimistic mutation until the turn SETTLES
 * — confirm or reject — and not one moment longer. The bound is the number of
 * unresolved operations, not a configured depth.
 *
 * `assessReclamationEligibility` already returns a `pending-reference` blocker
 * for exactly this case. It has no production caller, which is why the hazard
 * is reachable.
 *
 * ## ⚠️ WHAT THE VALUE TESTS DO NOT SHOW, and the reading it is easy to get wrong
 *
 * These tests delete the VALUE and leave the lifetime ledger alone.
 * Production reclamation does both: `retire-retained-value` deletes the value
 * AND calls either `retireSubject` — which writes `restoreAllowed: false` — or
 * `forgetSubject`. `planRestore` THROWS on `!restoreAllowed`.
 *
 * So reclamation does not break restoration by removing the bytes. It breaks it
 * through the lifetime record. That is what a claim has to protect, and it is
 * a different thing from what these tests deleted. Anyone reading "deleting the
 * backing was harmless" as "reclamation needs no claims" has the wrong half.
 *
 * Historical split, from the ledger-null work: 249 B/retired with nothing
 * reclaimed, 117 B with the ledger kept, 6 B with it forgotten. The value is
 * roughly half the cost and needs no claim; the ledger is the other half and
 * needs one.
 */

type Row = { id: string; name: string };

const tick = () => Promise.resolve();

type Rows = {
  addOne(row: Row): void;
  removeOne(id: string): void;
  changeId(from: string, to: string): void;
  updateOne(id: string, patch: Partial<Row>): void;
  ids(): string[];
  byId(id: string): (() => Row | undefined) | undefined;
  byIdOrFail(id: string): (() => Row | undefined) & {
    name: () => string | undefined;
  };
  __acquireEntityHandleForTesting?: (
    id: string
  ) => { subjectId: number } | undefined;
  __retireSubjectRetainedValueBackingForTesting?: (subjectId: number) => void;
  __prepareSubjectReclamation?: (
    subjectId: number,
    options: { causallyEligible: boolean }
  ) => unknown;
  __applyPreparedSubjectReclamation?: (prepared: unknown) => void;
};

type Store = {
  (): { rows: { all: Row[] } };
  $: { rows: Rows };
  transaction: (fn: () => void) => { confirm(): void; rollback(): void };
  undo(): void;
  destroy(): void;
};

const makeStore = (enhancers: unknown[]): Store =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: enhancers as never }
  ) as unknown as Store;

const subjectOf = (rows: Rows, id: string): number => {
  const handle = rows.__acquireEntityHandleForTesting?.(id);
  if (!handle) {
    throw new Error(`No handle for ${id}`);
  }
  return handle.subjectId;
};

/** Delete a retired subject's value bytes. Throws if it is not retired. */
const deleteValueBacking = (rows: Rows, subjectId: number): void => {
  rows.__retireSubjectRetainedValueBackingForTesting?.(subjectId);
};

/**
 * Full production reclamation: value bytes AND the lifetime record. Passing
 * `causallyEligible: true` deliberately bypasses the causal check, because the
 * point is to find out what that check is FOR.
 */
const fullyReclaim = (rows: Rows, subjectId: number): void => {
  const prepared = rows.__prepareSubjectReclamation?.(subjectId, {
    causallyEligible: true,
  });
  if (!prepared) {
    throw new Error(`No reclamation plan for subject ${subjectId}`);
  }
  rows.__applyPreparedSubjectReclamation?.(prepared);
};

describe('ownership of retired value backing', () => {
  it('THE OWNERSHIP: full reclamation of a PENDING subject breaks rollback', async () => {
    // The other half, and the one that decides whether `transactions()` needs a
    // claim at all. Every test below deletes only the VALUE and survives.
    // Production reclamation also drops the lifetime record, and `planRestore`
    // throws on `!restoreAllowed` — so this is where ownership actually lives.
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');
    const held = store.$.rows.byIdOrFail('a');

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne('a'));
    });
    await tick();

    fullyReclaim(store.$.rows, subject);

    expect(() => pending.rollback()).toThrow(
      /could not rollback the pending transaction/
    );
    // And the row is gone for good — this is data loss, not a degraded restore.
    expect(store.$.rows.ids()).toEqual([]);
    expect(held()).toBeUndefined();
  });

  it('CONTROL: the same turn rolls back when nothing is reclaimed', async () => {
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();
    const held = store.$.rows.byIdOrFail('a');

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne('a'));
    });
    await tick();
    pending.rollback();
    await tick();

    expect(store.$.rows.ids()).toEqual(['a']);
    expect(held()).toEqual({ id: 'a', name: 'Alpha' });
  });

  it('PENDING rollback restores correctly with the value bytes deleted', () => {
    // The state everyone assumes owns them. It does not: rollback restores
    // from the turn's own `__baselineValues`.
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    const subject = subjectOf(store.$.rows, 'a');

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne('a'));
    });
    expect(store.$.rows.ids()).toEqual([]);

    deleteValueBacking(store.$.rows, subject);
    pending.rollback();

    expect(store.$.rows.ids()).toEqual(['a']);
    expect(store.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });

  it('a HELD REFERENCE still re-publishes on rollback with the bytes deleted', () => {
    // The discriminating case. Value restoration and SUBJECT-LIFETIME
    // restoration are different properties, and the first version of this
    // probe only read a fresh handle — which would have passed even if the
    // held reference had been orphaned.
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    const subject = subjectOf(store.$.rows, 'a');
    const held = store.$.rows.byIdOrFail('a');
    const heldName = held.name;

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne('a'));
    });
    deleteValueBacking(store.$.rows, subject);
    pending.rollback();

    expect(held()).toEqual({ id: 'a', name: 'Alpha' });
    expect(heldName()).toBe('Alpha');
  });

  it('a HELD REFERENCE still re-publishes on time-travel undo with the bytes deleted', async () => {
    const store = makeStore([timeTravel({ maxHistorySize: 20 })]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');
    const held = store.$.rows.byIdOrFail('a');
    const heldName = held.name;

    undoable(() => store.$.rows.removeOne('a'));
    await tick();
    await tick();
    expect(held()).toBeUndefined();

    deleteValueBacking(store.$.rows, subject);
    store.undo();
    await tick();

    expect(held()).toEqual({ id: 'a', name: 'Alpha' });
    expect(heldName()).toBe('Alpha');
  });

  it('CONFIRMED: a settled removal is unreachable, so nothing can want the bytes', async () => {
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    undoable(() => store.$.rows.addOne({ id: 'b', name: 'Beta' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');

    store
      .transaction(() => {
        undoable(() => store.$.rows.removeOne('a'));
      })
      .confirm();
    await tick();

    deleteValueBacking(store.$.rows, subject);

    expect(store.$.rows.ids()).toEqual(['b']);
    undoable(() => store.$.rows.addOne({ id: 'c', name: 'Gamma' }));
    const later = store.transaction(() => {
      undoable(() => store.$.rows.updateOne('b', { name: 'Beta2' }));
    });
    later.rollback();
    expect(store.$.rows.byId('b')?.()?.name).toBe('Beta');
    expect(store.$.rows.ids().sort()).toEqual(['b', 'c']);
  });

  it('ABORTED: a subject created and discarded by a throwing transaction', async () => {
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();

    let freshSubject: number | undefined;
    expect(() =>
      store.transaction(() => {
        undoable(() => store.$.rows.addOne({ id: 'temp', name: 'Temp' }));
        freshSubject = subjectOf(store.$.rows, 'temp');
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(store.$.rows.ids()).toEqual(['a']);
    deleteValueBacking(store.$.rows, freshSubject as number);

    undoable(() => store.$.rows.addOne({ id: 'next', name: 'Next' }));
    // Identity must still be allocated forward — a discarded subject's number
    // is never handed out again.
    expect(subjectOf(store.$.rows, 'next')).toBeGreaterThan(
      freshSubject as number
    );
    expect(store.$.rows.ids().sort()).toEqual(['a', 'next']);
  });

  it('NO TURN IN FLIGHT: a plain retirement, then a full transaction', async () => {
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    undoable(() => store.$.rows.addOne({ id: 'b', name: 'Beta' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');

    undoable(() => store.$.rows.removeOne('a'));
    await tick();
    await tick();
    deleteValueBacking(store.$.rows, subject);

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.updateOne('b', { name: 'Beta2' }));
      undoable(() => store.$.rows.addOne({ id: 'c', name: 'Gamma' }));
    });
    expect(store.$.rows.ids().sort()).toEqual(['b', 'c']);
    pending.rollback();
    expect(store.$.rows.ids()).toEqual(['b']);
    expect(store.$.rows.byId('b')?.()?.name).toBe('Beta');
  });

  it('BOTH ENHANCERS: neither system needs the bytes when the other is present', async () => {
    const store = makeStore([timeTravel({ maxHistorySize: 20 }), transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');

    const pending = store.transaction(() => {
      undoable(() => store.$.rows.removeOne('a'));
    });
    deleteValueBacking(store.$.rows, subject);
    pending.rollback();

    expect(store.$.rows.ids()).toEqual(['a']);
    expect(store.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });

  it('DESTROYED: deleting backing after teardown does not throw', async () => {
    const store = makeStore([transactions()]);
    undoable(() => store.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await tick();
    await tick();
    const subject = subjectOf(store.$.rows, 'a');
    undoable(() => store.$.rows.removeOne('a'));
    await tick();
    await tick();

    store.destroy();
    // The sink runs at teardown too, and a throw there takes the cleanup with
    // it.
    expect(() => deleteValueBacking(store.$.rows, subject)).not.toThrow();
  });
});
