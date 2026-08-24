import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../time-travel/time-travel';
import { transactions } from './transactions';
import { undoable } from '../../lib/undoable';

/**
 * TURN-FEED-0 — the transaction lifecycle protocol, six pre-registered cases.
 *
 * `transactions()` announces `(owner, id)` lifecycle events; `timeTravel()`
 * observes them. The protocol carries LIFECYCLE ONLY — three events, never a
 * stream of mutation effects.
 *
 * The property that must not break: observing a lifecycle grants no restoration
 * rights. A confirmed transaction becomes a restoration turn only if it was
 * designated.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const designated = <T extends object>(state: T) =>
  signalTree(state, {
    enhancers: [
      timeTravel({
        maxHistorySize: 50,
      }),
      transactions(),
    ],
  });

const turns = (tree: { getHistory(): readonly unknown[] }) =>
  tree.getHistory().length - 1;

describe('TURN-FEED-0 case 1: pending isolation', () => {
  it('a pending transaction never reaches confirmed history', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();
    const before = tree.getHistory().length;

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // THE REGRESSION THIS PREVENTS. Before the protocol, the speculative row
    // appeared as a confirmed history entry with ownerPaths ['rows'] while the
    // transaction was still pending, because time-travel could not recognise a
    // transaction it did not own.
    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.rows.ids()).toEqual(['a']); // visible in STATE, as intended

    pending.rollback();
    await flush();
  });
});

describe('TURN-FEED-0 case 2: confirmation', () => {
  it('confirming is observed ONCE and does not double-record', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();
    const before = tree.getHistory().length;

    // Designated: this case asserts the confirmed transaction becomes exactly
    // ONE admitted turn, which requires it to be admitted at all.
    const pending = undoable(() =>
      tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
    );
    await flush();
    pending.confirm();
    await flush();

    expect(tree.getHistory().length).toBe(before + 1);

    // Idempotent: confirming twice must not announce twice.
    pending.confirm();
    await flush();
    expect(tree.getHistory().length).toBe(before + 1);
  });

  it('and admission is STILL decided by undoable(), not by confirming', async () => {
    const tree = designated({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    await flush();
    const before = turns(tree);

    tree
      .transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
      .confirm();
    await flush();

    // THE SEPARATION. The lifecycle was observed and the work committed, and it
    // is not an undo step. If this ever records a turn, the protocol has
    // recreated the conflation the flip exposed.
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(turns(tree)).toBe(before);
  });

  it('a DESIGNATED transaction records exactly one turn', async () => {
    const tree = designated({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    await flush();
    const before = turns(tree);

    undoable(() => {
      tree
        .transaction(() => {
          tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
          tree.$.rows.addOne({ id: 'b', name: 'Beta' });
        })
        .confirm();
    });
    await flush();

    expect(turns(tree)).toBe(before + 1);
    tree.undo();
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('TURN-FEED-0 case 3: rollback', () => {
  it('rolling back leaves no entry and no restoration claim', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();
    const before = tree.getHistory().length;

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();
    pending.rollback();
    await flush();

    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('TURN-FEED-0 case 4: surrounding writes', () => {
  it('write / transaction / write stay distinct, with no contamination', async () => {
    const tree = signalTree(
      { status: 'idle', other: 'before',
        rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();
    const before = tree.getHistory().length;

    // All three designated: the case is about three DISTINCT admitted turns and
    // the absence of cross-bucket contamination between them.
    undoable(() => tree.$.status.set('queued-before'));
    const pending = undoable(() =>
      tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
    );
    undoable(() => tree.$.other.set('queued-after'));
    await flush();

    // TWO entries while pending — the before-write and the after-write. The
    // transaction's own contribution is NOT among them. Getting three here was
    // the exact regression that blocked the TX-SURFACE-0 deletion.
    expect(tree.getHistory().length).toBe(before + 2);

    pending.confirm();
    await flush();
    expect(tree.getHistory().length).toBe(before + 3);
  });
});

describe('TURN-FEED-0 case 5: enhancer ordering', () => {
  const probe = async (order: 'tx-first' | 'tt-first') => {
    const tt = timeTravel({ maxHistorySize: 50 });
    const tx = transactions();
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: order === 'tx-first' ? [tx, tt] : [tt, tx] }
    );
    await flush();
    const before = tree.getHistory().length;

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();
    const whilePending = tree.getHistory().length - before;
    pending.confirm();
    await flush();
    return { whilePending, afterConfirm: tree.getHistory().length - before };
  };

  it('both orders behave identically', async () => {
    // Ordering still matters for WHICH transaction() answers, until the
    // duplicate is deleted — but the lifecycle behaviour must not depend on it.
    expect(await probe('tx-first')).toEqual(await probe('tt-first'));
  });
});

describe('TURN-FEED-0 case 6: ownership independence', () => {
  it('transactions() alone is unchanged by the protocol', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();
    expect(tree.$.rows.ids()).toEqual(['a']);

    pending.rollback();
    await flush();

    // Announcing to nobody is not an error. With no observer installed the
    // channel is inert.
    expect(tree.$.rows.ids()).toEqual([]);
  });
});
