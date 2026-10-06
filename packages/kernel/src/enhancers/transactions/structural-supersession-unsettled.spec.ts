import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * Structural supersession is a SETTLED-only fact on 15.x.
 *
 * `proposal-rejection-0.spec.ts` (ported from main) lets a pending add or
 * rekey whose subject later work removed stop blocking rollback: the removal
 * already performed the compensation. On 15.x the scalar path denies
 * supersession to an UNSETTLED superseder, because that later turn may itself
 * be rolled back and would then restore state naming the earlier turn's
 * speculative value. The structural arm keeps the same rule: an open turn's
 * remove is a dependency (`later-pending-dependency`, settle the newer first),
 * not a supersession. Neither case exists on main, whose ledger did not
 * distinguish unsettled later effects when the fix landed there.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const refusalKind = (pending: { rollback(): void }): false | unknown => {
  try {
    pending.rollback();
    return false;
  } catch (error) {
    return (error as { cause?: { kind?: unknown } })?.cause?.kind ?? 'error';
  }
};

const rowTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      x: 0,
    },
    { enhancers: [transactions()] }
  );

describe('structural supersession / unsettled remover', () => {
  it('refuses while the removing turn is open, then completes once it confirms', async () => {
    const tree = rowTree();
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    const remover = tree.transaction(() => {
      tree.$.rows.removeOne('A');
    });
    await flush();

    // The remover may still be rolled back and would re-add A as proposed.
    expect(refusalKind(proposal)).toBe('later-pending-dependency');
    expect(tree.$.x()).toBe(1);

    remover.confirm();
    await flush();

    // Now settled newer truth erased A: the reversal completes.
    expect(refusalKind(proposal)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('completes when settled work edited the row and then removed it', async () => {
    const tree = rowTree();
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    // Before 15.4.2 this sequence refused: the edit was a dependency and the
    // later remove did not clear it. The final later effect now decides.
    tree.$.rows.updateOne('A', { name: 'Edited' });
    tree.$.rows.removeOne('A');
    await flush();

    expect(refusalKind(proposal)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('still refuses when settled work edited the row and kept it', async () => {
    const tree = rowTree();
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    tree.$.rows.updateOne('A', { name: 'Edited' });
    await flush();

    expect(refusalKind(proposal)).toBe('later-confirmed-dependency');
    expect(tree.$.x()).toBe(1);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('Edited');
  });

  it('pending rekey: refuses while the removing turn is open, then completes once it confirms', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();

    const remover = tree.transaction(() => {
      tree.$.rows.removeOne('A2');
    });
    await flush();

    expect(refusalKind(proposal)).toBe('later-pending-dependency');
    expect(tree.$.x()).toBe(1);

    remover.confirm();
    await flush();

    expect(refusalKind(proposal)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('refuses while an open turn has edited the row, even after a settled remove', async () => {
    const tree = rowTree();
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    const editor = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Edited' });
    });
    await flush();

    tree.$.rows.removeOne('A');
    await flush();

    // Conservative: the open edit blocks supersession until it settles. The
    // reported kind is the first matching later effect IN TIME: the open edit,
    // so it says "settle the newer turn first", which is what clears it.
    // Through 15.4.4's review it read 'later-confirmed-dependency' because
    // later work was listed by source (authored, observed, open), putting the
    // settled remove first (reversal-engine review, item 4).
    expect(refusalKind(proposal)).toBe('later-pending-dependency');
    expect(tree.$.x()).toBe(1);
    expect(tree.$.rows.ids()).toEqual([]);

    editor.confirm();
    await flush();

    expect(refusalKind(proposal)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('completes after the remover rolls back and the proposed row returns', async () => {
    const tree = rowTree();
    await flush();

    const proposal = tree.transaction(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    const remover = tree.transaction(() => {
      tree.$.rows.removeOne('A');
    });
    await flush();

    expect(refusalKind(proposal)).toBe('later-pending-dependency');

    remover.rollback();
    await flush();
    expect(tree.$.rows.ids()).toEqual(['A']);

    // Nothing later stands on A any more; the proposal's own add compensates.
    expect(refusalKind(proposal)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});
