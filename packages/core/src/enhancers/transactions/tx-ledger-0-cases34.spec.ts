import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/**
 * TX-LEDGER-0 cases 3 and 4, asked of the implementation that OWNS rollback.
 *
 * Case 6 showed `transactions()` keeps its own dependency store, so these
 * questions belong here rather than against the duplicate `timeTravel()` path
 * that TX-SURFACE-0 is auditing for deletion.
 *
 * Both decide ledger admission, and neither answer is pre-registered:
 *
 *   3  which causal ORIGINS can create a rollback dependency? If a realization
 *      depending on speculative state does not refuse, admission is by
 *      authorship. If it does, admission is by causal effect regardless of
 *      origin. A server refresh landing mid-optimistic-transaction is the
 *      real-world shape.
 *
 *   4  can a dependency be REMOVED? If a reversed dependency makes rollback
 *      legal again, the projection must reason about current state. If not, it
 *      may be monotonic — simpler, and conservative in the safe direction.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', causalMode: 'realization' }, fn);

const refusalKind = (error: unknown): unknown =>
  (error as { cause?: { kind?: unknown } })?.cause?.kind;

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  );

describe('TX-LEDGER-0 case 3: does a REALIZATION create a rollback dependency?', () => {
  it('CONTROL — an AUTHORED dependent write refuses, as case 6 established', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    tree.$.rows.updateOne('a', { name: 'Edited' });
    await flush();

    let kind: unknown;
    try {
      pending.rollback();
    } catch (error) {
      kind = refusalKind(error);
    }
    expect(kind).toBe('later-confirmed-dependency');
  });

  it('⚠️ FINDING — a REALIZATION does NOT create a dependency; rollback discards it', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // A server refresh landing mid-transaction, touching the speculative row.
    realization(() => tree.$.rows.updateOne('a', { name: 'FromServer' }));
    await flush();

    let kind: unknown = 'did-not-refuse';
    try {
      pending.rollback();
    } catch (error) {
      kind = refusalKind(error);
    }

    // MEASURED: admission follows AUTHORSHIP. A realization creates no
    // dependency, so the rollback proceeds and REMOVES the row the server had
    // just written to.
    //
    // This is the same family as RESTORE-P0 P0-C one layer over: a reversal
    // discarding truth the reversing authority does not own. There it was undo
    // overwriting a realization; here it is rollback deleting a row a server
    // refresh had confirmed.
    //
    // Pinned as measured, and NOT repaired here — the disposition belongs with
    // the ledger design, because it is precisely the question of whether ledger
    // admission is by authorship or by causal effect.
    expect(kind).toBe('did-not-refuse');
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('TX-LEDGER-0 case 4: can a dependency be REMOVED?', () => {
  it('a dependent write, then that write reversed — is rollback legal again?', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // Create the dependency...
    tree.$.rows.updateOne('a', { name: 'Edited' });
    await flush();
    // ...then put the value back, by hand — the dependency's EFFECT is undone
    // without any restoration machinery involved.
    tree.$.rows.updateOne('a', { name: 'Alpha' });
    await flush();

    let kind: unknown = 'did-not-refuse';
    try {
      pending.rollback();
    } catch (error) {
      kind = refusalKind(error);
    }

    // MEASURED: it still refuses. The projection is MONOTONIC — once a
    // dependency exists it stands, even after the dependent write's effect is
    // reversed by hand.
    //
    // That is the conservative direction and an acceptable answer: it can refuse
    // a rollback that would in fact have been safe, but it never permits one
    // that is not. Recorded as the decision so a future ledger does not have to
    // reason about current state to be correct.
    expect(kind).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
  });
});
