import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './restoration';

/**
 * THE INVARIANT, and the reason it is written as an invariant rather than as a
 * list of cases:
 *
 *     claimed subjects  ===  union of `restorationSubjectIds` over the
 *                            entries still retained in history
 *
 * A funnel is only as good as the completeness of its call sites, and a call
 * site nobody wired is invisible — it leaks silently and every existing test
 * still passes. Asserting the invariant after each class of operation catches a
 * missed boundary without anyone having to enumerate the boundaries correctly,
 * which is the mistake that produced the leak in the first place.
 */

type Row = { id: string; name: string; v: number };

const seed = (prefix: string, width = 4): Row[] =>
  Array.from({ length: width }, (_, i) => ({
    id: `${prefix}-${i}`,
    name: `n${i}`,
    v: i,
  }));

const makeTree = (maxHistorySize: number) =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize })] }
  );

const tick = () => Promise.resolve();

function expectInvariant(tree: ReturnType<typeof makeTree>): {
  claimed: number[];
  entries: number;
} {
  const claims = getSubjectRestorationClaims(tree);
  if (!claims) {
    throw new Error('Expected a tree-scoped restoration claim registry');
  }

  const history = tree.getRestorationHistory() as Array<{
    restorationSubjectIds?: number[];
  }>;
  const expected = [
    ...new Set(history.flatMap((entry) => entry.restorationSubjectIds ?? [])),
  ].sort((a, b) => a - b);
  const actual = [...claims.claimedSubjects()].sort((a, b) => a - b);

  expect(actual).toEqual(expected);
  return { claimed: actual, entries: history.length };
}

describe('restoration claim boundary', () => {
  it('attaches one registry per tree, reachable from the tree', () => {
    const tree = makeTree(20);
    expect(getSubjectRestorationClaims(tree)).toBeDefined();
    // A second tree must not share it, or one tree's eviction frees another's
    // backing.
    expect(getSubjectRestorationClaims(makeTree(20))).not.toBe(
      getSubjectRestorationClaims(tree)
    );
  });

  it('holds the invariant through max-size eviction', async () => {
    const tree = makeTree(5);
    for (let g = 0; g < 40; g++) {
      undoable(() => tree.$.rows.setAll(seed(`g${g}`)));
      await tick();
      await tick();
      expectInvariant(tree);
    }

    // And the point of the whole exercise: the claimed set is bounded by the
    // window, not by the 160 subjects that have been retired. A `setAll`
    // retires up to 4 and adds up to 4, so an entry can name 8.
    const { claimed, entries } = expectInvariant(tree);
    expect(entries).toBeLessThanOrEqual(5);
    expect(claimed.length).toBeLessThanOrEqual(5 * 8);
  });

  it('holds the invariant through redo truncation after an undo', async () => {
    const tree = makeTree(20);
    undoable(() => tree.$.rows.setAll(seed('a')));
    await tick();
    await tick();
    for (let i = 0; i < 6; i++) {
      undoable(() => tree.$.rows.addOne({ id: `x-${i}`, name: 'x', v: i }));
      await tick();
      await tick();
    }
    expectInvariant(tree);

    tree.undo();
    tree.undo();
    tree.undo();
    await tick();
    expectInvariant(tree);

    // A write here discards the redo branch; those entries' claims must go
    // with it.
    undoable(() => tree.$.rows.addOne({ id: 'branch', name: 'b', v: 99 }));
    await tick();
    await tick();
    expectInvariant(tree);
  });

  it('holds the invariant through removals, changeId and clear', async () => {
    const tree = makeTree(8);
    undoable(() => tree.$.rows.setAll(seed('a')));
    await tick();
    await tick();

    undoable(() => tree.$.rows.removeOne('a-1'));
    await tick();
    await tick();
    expectInvariant(tree);

    undoable(() => tree.$.rows.changeId('a-2', 'a-2-renamed'));
    await tick();
    await tick();
    expectInvariant(tree);

    undoable(() => tree.$.rows.clear());
    await tick();
    await tick();
    expectInvariant(tree);

    undoable(() => tree.$.rows.setAll(seed('b')));
    await tick();
    await tick();
    expectInvariant(tree);
  });

  it('holds the invariant when the redo branch is discarded on a scalar tree', async () => {
    // Reaches the OTHER truncation path. `truncateScopedRedoFuture` only drops
    // position-indexed entries, so an entity tree never exercises the plain
    // `history.slice(0, currentIndex + 1)` in the record path — the first
    // version of this suite left that call site unmutated and green.
    const tree = signalTree(
      { count: 0, label: 'a' },
      { enhancers: [timeTravel({ maxHistorySize: 20 })] }
    );

    for (let i = 1; i <= 6; i++) {
      undoable(() => tree.$.count.set(i));
      await tick();
      await tick();
    }
    tree.undo();
    tree.undo();
    tree.undo();
    await tick();

    undoable(() => tree.$.label.set('branched'));
    await tick();
    await tick();

    const claims = getSubjectRestorationClaims(tree);
    const history = tree.getRestorationHistory() as Array<{
      restorationSubjectIds?: number[];
    }>;
    const expected = [
      ...new Set(history.flatMap((entry) => entry.restorationSubjectIds ?? [])),
    ].sort((a, b) => a - b);
    expect([...(claims?.claimedSubjects() ?? [])].sort((a, b) => a - b)).toEqual(
      expected
    );
    // Owners must not outlive the entries that minted them.
    expect(claims?.snapshot().owners).toBeLessThanOrEqual(history.length);
  });

  it('releases every owned claim on resetRestorationHistory, before turn ids restart', async () => {
    const tree = makeTree(20);
    for (let g = 0; g < 5; g++) {
      undoable(() => tree.$.rows.setAll(seed(`g${g}`)));
      await tick();
      await tick();
    }
    expect(expectInvariant(tree).claimed.length).toBeGreaterThan(0);

    tree.resetRestorationHistory();
    await tick();
    await tick();

    // The invariant alone would be satisfied by a stale claim set that happens
    // to match a stale history, so this asserts the absolute state: turn ids
    // restart at 1 after a reset, and a claim surviving under the old
    // `time-travel:1` would be inherited by the next entry to mint that name.
    expectInvariant(tree);
    const claims = getSubjectRestorationClaims(tree);
    expect(claims?.snapshot().owners).toBeLessThanOrEqual(1);
  });

  it('releases every owned claim on destroy', async () => {
    const tree = makeTree(20);
    for (let g = 0; g < 5; g++) {
      undoable(() => tree.$.rows.setAll(seed(`g${g}`)));
      await tick();
      await tick();
    }
    const claims = getSubjectRestorationClaims(tree);
    expect(claims?.snapshot().claimedSubjects).toBeGreaterThan(0);

    tree.destroy();
    await tick();

    expect(claims?.snapshot().claimedSubjects).toBe(0);
  });

  it('scales ownership with the WINDOW and not with total churn', async () => {
    // The asymptotic claim, stated the only way it can be falsified: hold the
    // churn fixed, vary the window, and see which one the inventory follows. A
    // single absolute bound would pass just as well if ownership tracked the
    // rounds and the constant happened to be generous.
    const churn = async (window: number, rounds: number) => {
      const tree = makeTree(window);
      for (let g = 0; g < rounds; g++) {
        undoable(() => tree.$.rows.setAll(seed(`g${g}`, 3)));
        await tick();
        await tick();
      }
      expectInvariant(tree);
      return getSubjectRestorationClaims(tree)?.snapshot();
    };

    const narrowShort = await churn(4, 30);
    const narrowLong = await churn(4, 120);
    const wide = await churn(12, 30);

    // 4x the churn, same window: unchanged.
    expect(narrowLong?.owners).toBe(narrowShort?.owners);
    expect(narrowLong?.claimedSubjects).toBe(narrowShort?.claimedSubjects);

    // 3x the window, same churn: grows with it.
    expect(wide?.owners).toBeGreaterThan(narrowShort?.owners ?? 0);
    expect(wide?.claimedSubjects).toBeGreaterThan(
      narrowShort?.claimedSubjects ?? 0
    );
  });
});
