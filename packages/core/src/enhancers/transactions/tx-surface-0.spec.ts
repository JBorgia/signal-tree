import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../time-travel/time-travel';
import { transactions } from './transactions';
import { undoable } from '../../lib/undoable';

/**
 * TX-SURFACE-0 — does `timeTravel().transaction()` deserve to exist?
 *
 * > NULL: `timeTravel()`'s `transaction()` has no independently owned public
 * > role and should be deleted in favour of `transactions()`.
 *
 * Context: `TimeTravelMethods extends TransactionMethods`, so `timeTravel()`
 * ships a SECOND `transaction()` implementation — and TX-LEDGER-0 measured that
 * one to be the less correct of the two, because its rollback dependency check
 * reads the restoration history rather than its own captured effects.
 *
 * Two public authorities for one concept, with semantics already drifting, is
 * the shape earlier audits kept deleting. So: audit before repairing.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const refusalKind = (error: unknown): unknown =>
  (error as { cause?: { kind?: unknown } })?.cause?.kind;

/** Which implementation answered, inferred from behaviour rather than identity. */
const probeRollbackOwner = async (
  tree: {
    $: { rows: { addOne(r: Row): void; updateOne(id: string, c: Partial<Row>): void } };
    transaction(fn: () => void): { rollback(): void };
  }
) => {
  const pending = tree.transaction(() => {
    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
  });
  await flush();
  tree.$.rows.updateOne('a', { name: 'Edited' });
  await flush();

  try {
    pending.rollback();
    return 'did-not-refuse';
  } catch (error) {
    return refusalKind(error);
  }
};

describe('TX-SURFACE-0: the duplicate transaction() surface', () => {
  it('ENHANCER ORDER — transactions() then timeTravel()', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions(), timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();
    expect(await probeRollbackOwner(tree)).toBe('later-confirmed-dependency');
  });

  it('ENHANCER ORDER — timeTravel() then transactions()', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();
    // ⚠️ NOTE ON WHAT THIS DOES AND DOES NOT PROVE. Both orders return the same
    // REFUSAL, but that is not the same as both being answered by the same
    // implementation. Under the 'all' default both implementations are correct,
    // so this probe cannot distinguish them — and the later-installed enhancer's
    // `transaction` overwrites the earlier one. Read this as "the answer agrees",
    // never as "there is no collision".
    expect(await probeRollbackOwner(tree)).toBe('later-confirmed-dependency');
  });

  it('CASE 6 — timeTravel() alone no longer answers transaction() at all', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();

    // The deletion, proved rather than assumed. This is the assertion that makes
    // the ownership change real: a transaction boundary requires the enhancer
    // that owns one.
    expect(
      (tree as unknown as { transaction?: unknown }).transaction
    ).toBeUndefined();
  });
});

describe('TX-SURFACE-0: the composed ownership story', () => {
  it('an ordinary transaction commits and is NOT undoable', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      {
        enhancers: [
          timeTravel({
            maxHistorySize: 50,
          }),
          transactions(),
        ],
      }
    );
    await flush();
    const before = tree.getHistory().length;

    tree
      .transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
      .confirm();
    await flush();

    // Grouping without admission: the work landed, and it is not a user undo
    // step.
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.getHistory().length).toBe(before);
  });

  it('undoable(() => transaction(...)) commits as ONE undoable turn', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      {
        enhancers: [
          timeTravel({
            maxHistorySize: 50,
          }),
          transactions(),
        ],
      }
    );
    await flush();
    const before = tree.getHistory().length;

    undoable(() => {
      tree
        .transaction(() => {
          tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
          tree.$.rows.addOne({ id: 'b', name: 'Beta' });
        })
        .confirm();
    });
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
    expect(tree.getHistory().length).toBe(before + 1);

    tree.undo();
    await flush();

    // THE OWNERSHIP STORY, end to end:
    //   transactions() groups the authored work
    //   undoable()     admits the resulting causal turn
    //   timeTravel()   restores admitted turns
    // No subsystem impersonating another.
    expect(tree.$.rows.ids()).toEqual([]);
  });
});
