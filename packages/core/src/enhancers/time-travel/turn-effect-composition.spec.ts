import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './time-travel';

/**
 * RESTORE-P0 — the full composition table, one case per row.
 *
 * The two pinned defect specs cover `add + remove` and `rekey + remove`, which
 * are the rows that had failing evidence behind them. The other rows went in
 * from the table, so they get their own coverage here rather than being trusted
 * because the table looked symmetrical.
 *
 * The invariant every case checks is the same one:
 *
 * > reversing a turn restores the state from before the WHOLE turn, never a
 * > state that existed only part-way through it
 */

type Row = { id: string; name: string };

const tick = () => Promise.resolve();
const flush = async () => {
  await tick();
  await tick();
};

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize: 50 })] }
  );

describe('RESTORE-P0 composition: add + X in one turn', () => {
  it('add + remove annihilates — and records NO TURN at all', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'seed', name: 'Seed' }]);
    await flush();
    const before = tree.getHistory().length;

    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    tree.$.rows.removeOne('a');
    await flush();
    expect(tree.$.rows.ids()).toEqual(['seed']);

    // THE ACTUAL CONTRACT, measured. My first expectation here was that undo
    // would be a no-op leaving `['seed']`. It is stronger than that: a turn
    // whose net structural effect is nothing is not recorded as a turn, so it
    // never becomes an undo step. Recording one would be a phantom entry —
    // `canUndo()` true, undo changes nothing visible, and the user spends a
    // step they never took.
    expect(tree.getHistory().length).toBe(before);

    // So undo reverses the PREVIOUS real operation, the seed `setAll`.
    tree.undo();
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('add + rekey is ONE creation under the final key', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'seed', name: 'Seed' }]);
    await flush();

    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    tree.$.rows.changeId('a', 'a2');
    await flush();
    expect(tree.$.rows.ids()).toEqual(['seed', 'a2']);

    tree.undo();
    await flush();

    // Reversing a creation removes it. The intermediate key 'a' existed only
    // inside the turn and must not be restorable.
    expect(tree.$.rows.ids()).toEqual(['seed']);
  });
});

describe('RESTORE-P0 composition: rekey + X in one turn', () => {
  it('rekey + rekey is ONE rename, original to final', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'a', name: 'Alpha' }]);
    await flush();

    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.changeId('a2', 'a3');
    await flush();
    expect(tree.$.rows.ids()).toEqual(['a3']);

    tree.undo();
    await flush();

    // Back to the ORIGINAL key, not to the intermediate 'a2'.
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });

  it('a rekey ROUND TRIP in one turn is no rename at all', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'a', name: 'Alpha' }]);
    await flush();

    const before = tree.getHistory().length;

    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.changeId('a2', 'a');
    await flush();
    expect(tree.$.rows.ids()).toEqual(['a']);

    // Same contract as annihilation: net nothing means no turn.
    expect(tree.getHistory().length).toBe(before);

    tree.undo();
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('rekey + remove reverses to the ORIGINAL key', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'a', name: 'Alpha' }]);
    await flush();

    tree.$.rows.changeId('a', 'a2');
    tree.$.rows.removeOne('a2');
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);

    tree.undo();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });
});

describe('RESTORE-P0 composition: the rows deliberately NOT composed', () => {
  it('separate TURNS still compose nothing — each reverses on its own', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'seed', name: 'Seed' }]);
    await flush();

    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await flush(); // <- turn boundary
    tree.$.rows.removeOne('a');
    await flush();

    expect(tree.$.rows.ids()).toEqual(['seed']);

    // Composition is a WITHIN-turn rule. Across turns these are two separate
    // operations and undo walks them one at a time — the control that proves
    // the composition is scoped to the turn and not to the subject's lifetime.
    tree.undo();
    await flush();
    expect(tree.$.rows.ids()).toEqual(['seed', 'a']);

    tree.undo();
    await flush();
    expect(tree.$.rows.ids()).toEqual(['seed']);
  });

  /**
   * ✅ REPAIRED — P0-D. Found by this suite, and NOT a composition problem.
   *
   * `remove('a')` then `addOne('a')` in one turn, then undo, used to THROW
   * `Entity with id a already exists` — an undo that crashes rather than one
   * that produces the wrong state.
   *
   * Composition cannot reach it: a removed key is tombstoned and re-adding it
   * mints a NEW subject, so the two effects belong to different subjects and
   * never share a slot. They are correctly two effects.
   *
   * The bug was a question asked at the wrong time. `planRestore` checked "is
   * this key free?" against pre-frame state, when the honest question is "will
   * this key be free when I commit?" — and the frame's own removals commit
   * before its restores. The planner already knew every key it was about to
   * vacate; it just never told the collection.
   *
   * A wrong fix was tried first: ordering the reversal so structural removes
   * precede adds. It changed nothing, because `applyAtomically` delegates to
   * `planHeterogeneousFrame`, which plans its own order — and the COMMIT order
   * was already correct. It was reverted rather than left in.
   *
   * PROVENANCE: pre-existing. Reproduced at `065e521d`, before the P0-A/B work.
   */
  it('REPAIRED (P0-D): remove then re-add of the same key reverses cleanly', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'a', name: 'Alpha' }]);
    await flush();

    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'a', name: 'Reborn' });
    await flush();
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Reborn');

    tree.undo();
    await flush();

    // The pre-turn state exactly: the ORIGINAL subject, under its original key,
    // with its original value — not the replacement that the turn introduced.
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });
});
