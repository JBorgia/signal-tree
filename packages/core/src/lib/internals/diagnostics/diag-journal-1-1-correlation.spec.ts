import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './diagnostic-journal';
import { entityMap } from '../../markers/entity-map';
import { getTransactionLifecycleChannel } from '../causal-runtime/transaction-lifecycle';
import { restoration } from '../../../enhancers/restoration/restoration';
import { signalTree } from '../../signal-tree';
import { transactions } from '../../../enhancers/transactions/transactions';

/**
 * DIAG-JOURNAL-1.1 — rollback provenance AND correlation, kept as two facts.
 *
 * DIAG-JOURNAL-1 measured that a compensation turn carries no way to say WHICH
 * transaction it compensates. Adding `origin: 'transaction-rollback'` answers a
 * different question:
 *
 * ```text
 * PROVENANCE    origin: 'transaction-rollback'   why this realized write exists
 * CORRELATION   transaction identity             which transaction it undoes
 * ```
 *
 * Making one metadata dimension answer both is the compression this release
 * has spent its whole length undoing, so both are proved separately here.
 *
 * ## The falsifier that has to run FIRST
 *
 * TURN-FEED identity is `{ owner, id }`, not `id`. Before diagnostics correlate
 * on a bare `transactionId`, prove that a bare id is unambiguous within one
 * tree — otherwise correlating on it silently collapses two identities into one.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Rows = { addOne(r: Row): void; ids(): string[] };
type Store = {
  $: { rows: Rows; n: { (): number; set(v: number): void } };
  transaction(fn: () => void): { confirm(): void; rollback(): void };
};

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as Store;

describe('DIAG-JOURNAL-1.1 FALSIFIER: is a bare transactionId unambiguous?', () => {
  it('one tree announces under exactly ONE owner, so ids do not collide', async () => {
    const tree = makeTree();
    await flush();

    const owners: unknown[] = [];
    const ids: number[] = [];
    const off = getTransactionLifecycleChannel(
      tree as unknown as object
    ).subscribe((e) => {
      if (!owners.includes(e.owner)) owners.push(e.owner);
      if (e.kind === 'opened') ids.push(e.id);
    });

    tree.transaction(() => tree.$.n.set(1)).confirm();
    await flush();
    tree.transaction(() => tree.$.n.set(2)).rollback();
    await flush();
    const nested = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' })
    );
    await flush();
    nested.confirm();
    await flush();
    off();

    // Both `restoration()` and `transactions()` are installed, and restoration
    // holds a transactionOwnerToken of its own — but it only LISTENS. The single
    // per-tree runtime is the only announcer, and its counter is the only source
    // of ids.
    expect(owners.length).toBe(1);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('CONTROL — a second TREE reuses the same numbers under a different owner', async () => {
    const a = makeTree();
    const b = makeTree();
    await flush();

    const seen: Array<{ tree: string; id: number; owner: unknown }> = [];
    const offA = getTransactionLifecycleChannel(
      a as unknown as object
    ).subscribe((e) => {
      if (e.kind === 'opened') seen.push({ tree: 'a', id: e.id, owner: e.owner });
    });
    const offB = getTransactionLifecycleChannel(
      b as unknown as object
    ).subscribe((e) => {
      if (e.kind === 'opened') seen.push({ tree: 'b', id: e.id, owner: e.owner });
    });

    a.transaction(() => a.$.n.set(1)).confirm();
    b.transaction(() => b.$.n.set(1)).confirm();
    await flush();
    offA();
    offB();

    // Ids are per-tree, so `1` means different things in different trees. A
    // journal is per-tree and never sees both, which is exactly WHY a bare id
    // suffices for it — and exactly why this must be stated rather than assumed.
    expect(seen.map((s) => s.id)).toEqual([1, 1]);
    expect(seen[0].owner).not.toBe(seen[1].owner);
  });
});

describe('DIAG-JOURNAL-1.1: the compensation turn is correlatable', () => {
  it('carries rollback provenance AND the transaction it compensates', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);

    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' })
    );
    await flush();
    pending.rollback();
    await flush();

    const shape = journal.turns().map((t) => ({
      txIds: [...new Set(t.effects.map((e) => e.transactionId))],
      origins: [...new Set(t.effects.map((e) => e.origin))],
      participations: [...new Set(t.effects.map((e) => e.participation))],
    }));

    expect(shape).toEqual([
      {
        txIds: [1],
        origins: [undefined],
        participations: [undefined],
      },
      {
        // CORRELATION: the same id the lifecycle stream reports rolled back.
        txIds: [1],
        // PROVENANCE: a distinct answer to "why does this realized write exist".
        origins: ['transaction-rollback'],
        participations: ['realized'],
      },
    ]);

    // And the reader can join the three facts WITHOUT temporal adjacency: the
    // speculative turn, the lifecycle outcome and the compensation all name
    // transaction 1.
    const rolledBack = journal
      .transactionEvents()
      .filter((e) => e.kind === 'rolled-back')
      .map((e) => e.id);
    expect(rolledBack).toEqual([1]);

    const compensation = journal
      .turns()
      .filter((t) =>
        t.effects.some((e) => e.origin === 'transaction-rollback')
      );
    expect(compensation.length).toBe(1);
    expect(
      compensation[0].effects.every((e) => e.transactionId === 1)
    ).toBe(true);

    journal.dispose();
  });

  it('a CONFIRMED transaction produces no compensation provenance', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);

    tree.transaction(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' })).confirm();
    await flush();

    // The control that keeps the origin meaningful: it marks compensation, not
    // "a write that happened near a transaction".
    expect(
      journal
        .turns()
        .flatMap((t) => t.effects.map((e) => e.origin))
        .filter((o) => o === 'transaction-rollback')
    ).toEqual([]);

    journal.dispose();
  });
});
