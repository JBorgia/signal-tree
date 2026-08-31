import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { restoration } from './restoration';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { undoable } from '../../lib/undoable';

/**
 * RESTORATION-REKEY-CLAIM-WIDTH-0.
 *
 * One `changeId` moves exactly one logical subject. A retained rekey turn must
 * therefore claim exactly that one subject — not every subject that happened to
 * participate in the previous collection-wide write.
 *
 * The defect was in the PRODUCER, not in restoration. `planRekey.commit()` and
 * `planPreparedRekey.commit()` were the only mutators that never narrowed the
 * `lastSubjectIds` last-write-participation latch. `wrapMutator` in
 * `intercept-leaf-signals` re-reads that latch after `changeId` returns and
 * reports it as the write's participation set; restoration then retained one
 * claim per live subject, giving an O(collection) `restorationSubjectIds` and an
 * O(collection) claim-ownership graph for a one-subject operation.
 *
 * These rows pin the fix at its owner (`__subjectIds` after a rekey) AND at the
 * observable restoration outcome (one retained claim), so a future producer
 * refactor cannot silently re-widen it.
 */

type Row = { id: number; name: string; v: number };

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const seed = (width: number): Row[] =>
  Array.from({ length: width }, (_, i) => ({ id: i + 1, name: `n${i}`, v: i }));

const makeTree = (maxHistorySize = 1) =>
  signalTree(
    { rows: entityMap<Row, number>({ selectId: (r) => r.id }) },
    { enhancers: [restoration({ maxHistorySize })] }
  );

// The producer's last-write participation latch, read exactly where the
// leaf-signal interceptor reads it.
const participation = (tree: ReturnType<typeof makeTree>): number[] | undefined =>
  (tree.$.rows as unknown as { __subjectIds?: number[] }).__subjectIds;

const claimedCount = (tree: ReturnType<typeof makeTree>): number =>
  getSubjectRestorationClaims(tree)?.snapshot().claimedSubjects ?? 0;

const retainedSubjectIds = (tree: ReturnType<typeof makeTree>): number[] => {
  const history = tree.getRestorationHistory() as Array<{
    restorationSubjectIds?: number[];
  }>;
  return [
    ...new Set(history.flatMap((entry) => entry.restorationSubjectIds ?? [])),
  ];
};

describe('RESTORATION-REKEY-CLAIM-WIDTH-0 — producer participation', () => {
  it('after setAll(N) then changeId(one), participation is exactly the rekeyed subject', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll(seed(200)));
    await settle();
    expect(participation(tree)?.length).toBe(200);

    const rekeyed = (tree.$.rows.byIdOrFail(100).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];
    undoable(() => tree.$.rows.changeId(100, 10_000));
    await settle();

    expect(participation(tree)).toEqual([rekeyed]);
  });

  it('after an arbitrary prior mutator then changeId(one), participation is exactly the rekeyed subject', async () => {
    for (const prior of ['updateOne', 'addOne', 'removeOne'] as const) {
      const tree = makeTree();
      undoable(() => tree.$.rows.setAll(seed(50)));
      await settle();

      if (prior === 'updateOne') tree.$.rows.updateOne(3, { v: 99 });
      if (prior === 'addOne') tree.$.rows.addOne({ id: 999, name: 'x', v: 0 });
      if (prior === 'removeOne') tree.$.rows.removeOne(7);
      await settle();

      const rekeyed = (tree.$.rows.byIdOrFail(20).name as unknown as {
        __subjectIds?: number[];
      }).__subjectIds?.[0];
      undoable(() => tree.$.rows.changeId(20, 20_000));
      await settle();

      expect(participation(tree)).toEqual([rekeyed]);
    }
  });

  it('the prepared/transactional rekey path also narrows participation', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>({ selectId: (r) => r.id }) },
      { enhancers: [restoration({ maxHistorySize: 5 }), transactions()] }
    ) as ReturnType<typeof makeTree> & {
      transaction: (fn: () => void) => { rollback(): void; confirm(): void };
    };

    tree.$.rows.setAll(seed(80));
    await settle();

    const rekeyed = (tree.$.rows.byIdOrFail(40).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];

    const pending = tree.transaction(() => tree.$.rows.changeId(40, 40_000));
    pending.confirm();
    await settle();

    expect(participation(tree)).toEqual([rekeyed]);
  });

  it('a no-op rekey cannot re-publish a prior bulk write into a designated turn', async () => {
    // The leaf-signal interceptor fires on EVERY mutator call, including one
    // that changes nothing, and there is no next!==prev guard on that route.
    // Before the no-op branch narrowed the latch, a no-op `changeId(k, k)`
    // preceding a real designated write in the same tick re-published the
    // previous bulk write's participation set into the capture bucket —
    // 50 claims for a turn that touched one subject. The latch is a
    // LAST-write latch, so what must hold is the captured turn's subject set,
    // not the post-turn latch value.
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll(seed(50)));
    await settle();
    expect(participation(tree)?.length).toBe(50);

    const noOpSubject = (tree.$.rows.byIdOrFail(10).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];
    const realSubject = (tree.$.rows.byIdOrFail(20).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];

    undoable(() => {
      tree.$.rows.changeId(10, 10); // no-op: same key, fires the interceptor
      tree.$.rows.updateOne(20, { v: 99 });
    });
    await settle();

    const history = tree.getRestorationHistory() as Array<{
      restorationSubjectIds?: number[];
    }>;
    const last = history[history.length - 1];
    // The turn names only the subjects its own calls addressed — the no-op's
    // one subject and the real write's one subject — never the stale 50.
    expect(last.restorationSubjectIds).toHaveLength(2);
    expect(last.restorationSubjectIds).toContain(realSubject);
    expect(last.restorationSubjectIds).toContain(noOpSubject);
    expect(claimedCount(tree)).toBe(2);
  });

  it('a rejected rekey (occupied destination) captures nothing and leaves history unchanged', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll(seed(50)));
    await settle();
    const entriesBefore = tree.getRestorationHistory().length;
    const latchBefore = participation(tree);

    expect(() => tree.$.rows.changeId(10, 11)).toThrow(/already in use/);
    await settle();

    // The throw happens before any frame commits, so the latch is untouched
    // and no turn is recorded.
    expect(participation(tree)).toBe(latchBefore);
    expect(tree.getRestorationHistory().length).toBe(entriesBefore);
  });

  it('redo of a designated rekey turn re-narrows participation', async () => {
    // A PURE rekey reversal replays through `__planRekey.commit()` — the
    // prepared planner is only reached when the reversal batch first
    // introduces the subject via a restore/add effect, which capture-time
    // coalescing prevents for a same-subject rekey inside one turn. This pins
    // the observable law either way: after redo settles, participation and
    // the retained turn name exactly the one rekeyed subject, at any size.
    for (const width of [30, 600]) {
      const tree = makeTree(5);
      tree.$.rows.setAll(seed(width));
      await settle();
      const from = Math.floor(width / 2);
      const rekeyed = (tree.$.rows.byIdOrFail(from).name as unknown as {
        __subjectIds?: number[];
      }).__subjectIds?.[0];

      undoable(() => tree.$.rows.changeId(from, width * 100));
      await settle();
      tree.undo();
      await settle();
      tree.redo();
      await settle();

      expect(participation(tree)).toEqual([rekeyed]);
      expect(retainedSubjectIds(tree)).toEqual([rekeyed]);
      expect(claimedCount(tree)).toBe(1);
      expect(tree.$.rows.ids()).toContain(width * 100);
    }
  });
});

describe('RESTORATION-REKEY-CLAIM-WIDTH-0 — restoration claim width', () => {
  it('one rekey retains exactly one claim, independent of collection size', async () => {
    for (const width of [50, 200, 1000]) {
      const tree = makeTree();
      undoable(() => tree.$.rows.setAll(seed(width)));
      await settle();
      undoable(() => tree.$.rows.changeId(Math.floor(width / 2), width * 100));
      await settle();

      expect(retainedSubjectIds(tree)).toHaveLength(1);
      expect(claimedCount(tree)).toBe(1);
    }
  });

  it('holds identity across the rekey: held ref follows, old key stops resolving', async () => {
    const tree = makeTree();
    undoable(() => tree.$.rows.setAll(seed(20)));
    await settle();

    const heldName = tree.$.rows.byIdOrFail(5).name as unknown as {
      (): string | undefined;
      __subjectIds?: number[];
    };
    const subjectId = heldName.__subjectIds?.[0];

    undoable(() => tree.$.rows.changeId(5, 500));
    await settle();

    expect(tree.$.rows.byId(5)?.()).toBeUndefined();
    expect(tree.$.rows.ids()).toContain(500);
    expect(
      (tree.$.rows.byIdOrFail(500).name as unknown as { __subjectIds?: number[] })
        .__subjectIds?.[0]
    ).toBe(subjectId);
    expect(heldName()).toBe('n4');
  });

  it('undo restores the old key, redo restores the new key, order preserved', async () => {
    const tree = makeTree(5);
    tree.$.rows.setAll(seed(5));
    await settle();
    const before = tree.$.rows.ids();

    undoable(() => tree.$.rows.changeId(3, 300));
    await settle();
    expect(tree.$.rows.ids()).toEqual(before.map((id) => (id === 3 ? 300 : id)));

    tree.undo();
    await settle();
    expect(tree.$.rows.ids()).toEqual(before);

    tree.redo();
    await settle();
    expect(tree.$.rows.ids()).toEqual(before.map((id) => (id === 3 ? 300 : id)));
    expect(claimedCount(tree)).toBe(1);
  });

  it('a rolled-back transactional rekey retains zero claims and leaves the collection unchanged', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>({ selectId: (r) => r.id }) },
      { enhancers: [restoration({ maxHistorySize: 5 }), transactions()] }
    ) as ReturnType<typeof makeTree> & {
      transaction: (fn: () => void) => { rollback(): void; confirm(): void };
    };

    tree.$.rows.setAll(seed(30));
    await settle();
    const before = tree.$.rows.ids();

    const pending = tree.transaction(() => tree.$.rows.changeId(15, 1500));
    pending.rollback();
    await settle();

    expect(tree.$.rows.ids()).toEqual(before);
    expect(claimedCount(tree)).toBe(0);
  });

  it('eviction releases the rekey claim', async () => {
    const tree = makeTree(1);
    undoable(() => tree.$.rows.setAll(seed(40)));
    await settle();

    const rekeyedSubject = (tree.$.rows.byIdOrFail(20).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0] as number;
    undoable(() => tree.$.rows.changeId(20, 2000));
    await settle();
    expect(retainedSubjectIds(tree)).toEqual([rekeyedSubject]);
    expect(claimedCount(tree)).toBe(1);

    // A second retained turn evicts the rekey entry at capacity 1.
    undoable(() => tree.$.rows.updateOne(1, { v: 42 }));
    await settle();

    expect(retainedSubjectIds(tree)).not.toContain(rekeyedSubject);
    expect(claimedCount(tree)).toBe(retainedSubjectIds(tree).length);
  });

  it('a fresh occupant of the freed key gets a distinct SubjectId', async () => {
    const tree = makeTree(5);
    undoable(() => tree.$.rows.setAll(seed(10)));
    await settle();

    const originalSubject = (tree.$.rows.byIdOrFail(4).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];

    undoable(() => tree.$.rows.changeId(4, 400));
    await settle();
    tree.$.rows.addOne({ id: 4, name: 'fresh', v: -1 });
    await settle();

    const freshSubject = (tree.$.rows.byIdOrFail(4).name as unknown as {
      __subjectIds?: number[];
    }).__subjectIds?.[0];

    expect(freshSubject).not.toBe(originalSubject);
    expect(
      (tree.$.rows.byIdOrFail(400).name as unknown as { __subjectIds?: number[] })
        .__subjectIds?.[0]
    ).toBe(originalSubject);
  });
});
