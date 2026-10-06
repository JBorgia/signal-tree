import { describe, expect, it } from 'vitest';

import { external } from '../../lib/external';
import { restorationReader } from '../../lib/internals/restoration-reader';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from '../transactions/transactions';
import { restoration } from './restoration';

/**
 * Which removals and holders the ordinary-write rule of
 * `ordinary-removal-undo.spec.ts` may act on (15.4.4, undo-rules review of
 * b2107f43; the probes are kept with the review evidence).
 *
 * (iii) Only an ORDINARY authored removal lets undo or redo of an edit put
 * the row back. A removal by external or realized truth (`external()`, a
 * Link inbound write) is truth history does not own: when the lifetime's
 * latest removal, or any later change to its key, came from such truth, the
 * reversal refuses with a typed ST1034 and changes nothing. The row came back
 * (review items B4, B4b, B5).
 *
 * (ii, widened) ANY other lifetime holding the key when the row would be put
 * back is a conflict, whatever its id: a rename keeps its id, so an "older"
 * row can take the key later. The exception is a holder the same operation
 * removes or renames off the key. It threw an untyped structural-drift when
 * the holder was older (review items A1, A2).
 *
 * (iv) A removal inside a CONFIRMED transaction that is not undoable is
 * ordinary authored work, and (i) applies to it. It threw structural-drift
 * (review item D1). A rejected transaction's removal never happened (D2), and
 * a pending one keeps the typed pending-overlap refusal (D4).
 */
type Row = { id: string; n: number; m: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const declaration = () => ({
  x: 0,
  rows: entityMap<Row, string>({ selectId: (row) => row.id }),
});
const typed = () =>
  signalTree(declaration(), { enhancers: [transactions(), restoration()] });
type Tree = ReturnType<typeof typed>;
const row = (id: string, n: number) => ({ id, n, m: n });
const read = (tree: Tree) =>
  tree.$.rows
    .all()
    .map((each) => `${each.id}${each.n}.${each.m}`)
    .join(',');

const configurations = [
  ['restoration()', () => [restoration()], false],
  [
    'transactions(), restoration()',
    () => [transactions(), restoration()],
    true,
  ],
  [
    'restoration(), transactions()',
    () => [restoration(), transactions()],
    true,
  ],
] as const;
const make = (enhancers: () => readonly unknown[]) =>
  signalTree(declaration(), {
    enhancers: enhancers() as never,
  }) as unknown as Tree;

/** A Link inbound (realized) write, as the realization port marks it. */
const realized = (write: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, write);

/** z, a, c, and an undoable edit of a. */
const seed = async (tree: Tree) => {
  tree.$.rows.addMany([row('z', 0), row('a', 1), row('c', 3)]);
  await flush();
  undoable(() => tree.$.rows.updateOne('a', { n: 5 }));
  await flush();
};

/** A typed refusal: the message, nothing changed, the reader says refused. */
const expectRefusal = async (
  tree: Tree,
  step: () => void,
  operation: 'undo' | 'redo',
  message: string
) => {
  const reader = restorationReader(tree as never)!;
  const events: { kind: string; operation?: string; outcome?: string }[] = [];
  const stop = reader.subscribe((event) => events.push(event as never));
  const before = read(tree);
  const index = tree.getCurrentIndex();
  try {
    expect(step).toThrow(message);
    await flush();
    expect(read(tree)).toBe(before);
    expect(tree.getCurrentIndex()).toBe(index);
    expect(
      events.filter(({ kind }) => kind === 'operation').at(-1)
    ).toMatchObject({ operation, outcome: 'refused' });
  } finally {
    stop();
  }
};
const EXTERNAL =
  "ST1034: restoration refused — row 'a' of 'rows' was removed or replaced by external truth";
const HELD =
  "ST1034: restoration refused — key 'a' of 'rows' is held by another row";

describe.each(configurations)(
  '(iii) a row removed or replaced by external or realized truth (%s)',
  (_name, enhancers) => {
    it('an external removal after the edit: undo refuses, typed (B4)', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
        expect(read(tree)).toBe('z0.0,c3.3');
        expect(tree.canUndo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });

    it('a realized (Link inbound) removal after the edit: undo refuses, typed (B5)', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        realized(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
      } finally {
        tree.destroy();
      }
    });

    it('an ordinary removal, then an external add and removal at the key: undo refuses, typed (B4b)', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        tree.$.rows.updateOne('a', { m: 7 });
        tree.$.rows.removeOne('a');
        await flush();
        external(() => tree.$.rows.addOne(row('a', 50)));
        await flush();
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
      } finally {
        tree.destroy();
      }
    });

    it('an ordinary removal, then a realized add and removal at the key: undo refuses, typed', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        tree.$.rows.removeOne('a');
        await flush();
        realized(() => tree.$.rows.addOne(row('a', 60)));
        await flush();
        realized(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
      } finally {
        tree.destroy();
      }
    });

    it('redo of the edit after an external removal: refuses, typed', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        tree.undo();
        await flush();
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.redo(), 'redo', EXTERNAL);
        expect(tree.canRedo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });

    it('an external removal in the same flush as a later undoable write: undo of the edit refuses, typed', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        // The removal lands in that entry's own history event.
        undoable(() => tree.$.x(1));
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        tree.undo();
        await flush();
        expect(tree.$.x()).toBe(0);
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
      } finally {
        tree.destroy();
      }
    });

    it('an external removal beside an undoable write that changed nothing: undo of the edit refuses, typed', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        // An undoable write that changes nothing records no entry of its own.
        undoable(() => tree.$.rows.updateOne('z', { n: 0 }));
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', EXTERNAL);
      } finally {
        tree.destroy();
      }
    });

    // The entry's OWN removal is not this rule's: undo of it compares the key
    // with what the turn left, as a scalar undo compares the value (owner
    // decision on the review follow-up).
    it("undo of an entry's own removal after external truth added and removed the key: proceeds", async () => {
      const tree = make(enhancers);
      try {
        tree.$.rows.addMany([row('z', 0), row('a', 1)]);
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        external(() => tree.$.rows.addOne(row('a', 50)));
        await flush();
        external(() => tree.$.rows.removeOne('a'));
        await flush();
        // The key is absent again, as the turn left it.
        tree.undo();
        await flush();
        expect(read(tree)).toBe('z0.0,a1.1');
      } finally {
        tree.destroy();
      }
    });

    it("undo of an entry's own removal while external truth holds the key: refuses, typed", async () => {
      const tree = make(enhancers);
      try {
        tree.$.rows.addMany([row('z', 0), row('a', 1)]);
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        external(() => tree.$.rows.addOne(row('a', 50)));
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', HELD);
        expect(read(tree)).toBe('z0.0,a50.50');
      } finally {
        tree.destroy();
      }
    });

    it('an ordinary removal is still put back (control)', async () => {
      const tree = make(enhancers);
      try {
        await seed(tree);
        tree.$.rows.removeOne('a');
        await flush();
        tree.undo();
        await flush();
        expect(read(tree)).toBe('z0.0,a1.1,c3.3');
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each(configurations)(
  '(ii) any other row holding the key (%s)',
  (_name, enhancers) => {
    it('undo of a removal while an older row was renamed onto the key: refuses, typed (A2)', async () => {
      const tree = make(enhancers);
      try {
        tree.$.rows.addMany([row('z', 0), row('q', 2)]);
        tree.$.rows.addOne(row('a', 1));
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        tree.$.rows.changeId('q', 'a');
        await flush();
        await expectRefusal(tree, () => tree.undo(), 'undo', HELD);
        // Once that row leaves the key, the undo puts the row back.
        tree.$.rows.changeId('a', 'q');
        await flush();
        tree.undo();
        await flush();
        expect(read(tree)).toBe('z0.0,q2.2,a1.1');
      } finally {
        tree.destroy();
      }
    });

    it('redo of an add while an older row was renamed onto the key: refuses, typed (A1)', async () => {
      const tree = make(enhancers);
      try {
        tree.$.rows.addMany([row('z', 0), row('q', 2)]);
        await flush();
        undoable(() => tree.$.rows.addOne(row('a', 1)));
        await flush();
        tree.$.rows.removeOne('a');
        await flush();
        tree.$.rows.changeId('q', 'a');
        await flush();
        tree.undo();
        await flush();
        // `changeId` moves the key, not the payload's `id`: q's row is at 'a'.
        expect(tree.$.rows.ids()).toStrictEqual(['z', 'a']);
        expect(read(tree)).toBe('z0.0,q2.2');
        await expectRefusal(tree, () => tree.redo(), 'redo', HELD);
        expect(tree.canRedo()).toBe(true);
      } finally {
        tree.destroy();
      }
    });

    it('a holder the same operation renames off the key: no refusal', async () => {
      const tree = make(enhancers);
      try {
        undoable(() => tree.$.rows.addMany([row('z', 0), row('q', 2)]));
        await flush();
        undoable(() => tree.$.rows.addOne(row('a', 1)));
        await flush();
        undoable(() => tree.$.rows.removeOne('a'));
        await flush();
        undoable(() => tree.$.rows.changeId('q', 'a'));
        await flush();
        // One operation renames q off 'a', then puts a back.
        tree.jumpTo(1);
        await flush();
        expect(read(tree)).toBe('z0.0,q2.2,a1.1');
      } finally {
        tree.destroy();
      }
    });
  }
);

describe.each(
  configurations.filter(([, , withTransactions]) => withTransactions)
)('(iv) a removal inside a transaction (%s)', (_name, enhancers) => {
  it('confirmed, not undoable: ordinary work, so undo of the edit puts the row back (D1)', async () => {
    const tree = make(enhancers);
    try {
      await seed(tree);
      const pending = tree.transaction(() => {
        tree.$.rows.updateOne('a', { m: 7 });
        tree.$.rows.removeOne('a');
      });
      await flush();
      pending.confirm();
      await flush();
      expect(read(tree)).toBe('z0.0,c3.3');
      tree.undo();
      await flush();
      expect(read(tree)).toBe('z0.0,a1.7,c3.3');
      expect(() => tree.getRestorationHistory()).not.toThrow();
      tree.redo();
      await flush();
      expect(read(tree)).toBe('z0.0,a5.7,c3.3');
      tree.undo();
      await flush();
      expect(read(tree)).toBe('z0.0,a1.7,c3.3');
    } finally {
      tree.destroy();
    }
  });

  it('rejected: the removal never happened, so undo reverses the edit (D2)', async () => {
    const tree = make(enhancers);
    try {
      await seed(tree);
      const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
      await flush();
      pending.rollback();
      await flush();
      expect(
        tree
          .getRestorationHistory()
          .map((entry) => (entry.state as unknown as { x: number }).x)
      ).toStrictEqual([0]);
      expect(read(tree)).toBe('z0.0,a5.1,c3.3');
      tree.undo();
      await flush();
      expect(read(tree)).toBe('z0.0,a1.1,c3.3');
    } finally {
      tree.destroy();
    }
  });

  it('confirmed, not undoable: history reads the states around it, in the order its writes happened', async () => {
    const tree = make(enhancers);
    try {
      undoable(() => tree.$.x(1));
      await flush();
      const pending = tree.transaction(() => tree.$.x(2));
      await flush();
      // Written while it is open; recorded before it confirms.
      tree.$.x(3);
      await flush();
      pending.confirm();
      await flush();
      undoable(() => tree.$.rows.addOne(row('k', 7)));
      await flush();
      expect(
        tree
          .getRestorationHistory()
          .map((entry) => (entry.state as unknown as { x: number }).x)
      ).toStrictEqual([1, 3]);
    } finally {
      tree.destroy();
    }
  });

  it('rejected, not undoable: no trace in history (a row it added, then an edit of another)', async () => {
    const tree = make(enhancers);
    try {
      await seed(tree);
      const pending = tree.transaction(() => tree.$.rows.addOne(row('k', 7)));
      await flush();
      pending.rollback();
      await flush();
      undoable(() => tree.$.rows.updateOne('z', { n: 4 }));
      await flush();
      expect(
        tree
          .getRestorationHistory()
          .map((entry) =>
            (entry.state as unknown as { rows: { all: Row[] } }).rows.all
              .map((each) => each.id)
              .join('')
          )
      ).toStrictEqual(['zac', 'zac']);
      tree.undo();
      tree.undo();
      await flush();
      expect(read(tree)).toBe('z0.0,a1.1,c3.3');
    } finally {
      tree.destroy();
    }
  });

  it('pending: undo refuses with the typed pending-overlap refusal (D4)', async () => {
    const tree = make(enhancers);
    try {
      await seed(tree);
      const pending = tree.transaction(() => tree.$.rows.removeOne('a'));
      await flush();
      await expectRefusal(
        tree,
        () => tree.undo(),
        'undo',
        'overlaps a pending transaction'
      );
      pending.rollback();
      await flush();
      expect(read(tree)).toBe('z0.0,a5.1,c3.3');
    } finally {
      tree.destroy();
    }
  });
});
