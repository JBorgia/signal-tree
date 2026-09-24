import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * PROPOSAL-0 — PHASE A, KERNEL MATRIX. Preregistered in TODO.md.
 *
 * > NULL: propose/accept/reject is a truthful NAMING of existing transaction
 * > semantics, introducing NO new kernel state semantics.
 * >
 * >     propose -> transaction     accept -> confirm     reject -> rollback
 *
 * The null fails if any case needs a rule `transaction()` does not have.
 *
 * NO PUBLIC API IS NAMED HERE. Every case is written against the shipped
 * primitives on purpose: if the matrix passes, that IS the evidence that a
 * facade would add naming and nothing else. Framework realization is Phase B
 * and is a mandatory release criterion, not follow-up.
 *
 * Reject-side conflict behaviour is NOT re-derived here; it is owned by
 * `pending-rejection-0.spec.ts` and `rekey-supersession-0.spec.ts`. This file
 * covers the ACCEPT side, the composite lifecycle, and concurrency.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

const tryRollback = (pending: { rollback(): void }): false | unknown => {
  try {
    pending.rollback();
    return false;
  } catch (error) {
    return (error as { cause?: { kind?: unknown } })?.cause?.kind ?? 'error';
  }
};

const plainTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      name: '',
      phone: '',
      priority: 0,
      untouched: 'safe',
    },
    { enhancers: [transactions()] }
  );

const restorableTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      name: '',
      priority: 0,
    },
    { enhancers: [restoration({ maxHistorySize: 50 }), transactions()] }
  );

describe('PROPOSAL-0 / A1 — clean accept', () => {
  it('speculative values are readable before accept and survive it', async () => {
    const tree = plainTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.name('Samuel');
    });
    await flush();

    // A reviewer sees the proposed value through ordinary references.
    expect(tree.$.name()).toBe('Samuel');

    pending.confirm();
    await flush();

    expect(tree.$.name()).toBe('Samuel');
  });
});

describe('PROPOSAL-0 / A2 — clean reject', () => {
  it('withdraws the pending through the same references', async () => {
    const tree = plainTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.name('Samuel');
    });
    await flush();

    expect(tree.$.name()).toBe('Samuel');
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.name()).toBe('');
  });
});

describe('PROPOSAL-0 / A3 — multi-field pending is one unit', () => {
  it('accept and reject both act on every field together', async () => {
    const accepted = plainTree();
    await flush();
    accepted
      .transact(() => {
        accepted.$.name('Samuel');
        accepted.$.phone('555-0100');
        accepted.$.priority(3);
      })
      .confirm();
    await flush();
    expect({
      name: accepted.$.name(),
      phone: accepted.$.phone(),
      priority: accepted.$.priority(),
    }).toEqual({ name: 'Samuel', phone: '555-0100', priority: 3 });

    const rejected = plainTree();
    await flush();
    const pending = rejected.transact(() => {
      rejected.$.name('Samuel');
      rejected.$.phone('555-0100');
      rejected.$.priority(3);
    });
    await flush();
    expect(tryRollback(pending)).toBe(false);
    expect({
      name: rejected.$.name(),
      phone: rejected.$.phone(),
      priority: rejected.$.priority(),
    }).toEqual({ name: '', phone: '', priority: 0 });
  });
});

describe('PROPOSAL-0 / A4 — multi-entity pending is one unit', () => {
  it('no partial settlement across entities', async () => {
    const tree = plainTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      tree.$.rows.addOne({ id: 'b', name: 'Beta' });
    });
    await flush();

    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('PROPOSAL-0 / A5 — human edits an UNRELATED field during a pending', () => {
  it('the human edit survives rejection', async () => {
    const tree = plainTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.name('Samuel');
    });
    await flush();

    tree.$.untouched('edited-by-human');
    await flush();

    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.name()).toBe('');
    expect(tree.$.untouched()).toBe('edited-by-human');
  });
});

describe('PROPOSAL-0 / A6 — server realization during a pending, then ACCEPT', () => {
  it('records what accept does to a location the server already moved', async () => {
    const tree = plainTree();
    await flush();

    const pending = tree.transact(() => {
      tree.$.name('FromAgent');
      tree.$.priority(3);
    });
    await flush();

    realization(() => tree.$.name('FromServer'));
    await flush();

    expect(tree.$.name()).toBe('FromServer');

    pending.confirm();
    await flush();

    // MEASURED, not asserted as desirable: what a reader sees after accepting
    // a pending whose location newer truth already overwrote.
    expect({ name: tree.$.name(), priority: tree.$.priority() }).toEqual({
      name: 'FromServer',
      priority: 3,
    });
  });
});

describe('PROPOSAL-0 / A7 — mixed scalar + structural pending', () => {
  it('accepts coherently as one turn', async () => {
    const tree = plainTree();
    await flush();

    tree
      .transact(() => {
        tree.$.priority(7);
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
      .confirm();
    await flush();

    expect({ priority: tree.$.priority(), ids: tree.$.rows.ids() }).toEqual({
      priority: 7,
      ids: ['a'],
    });
  });
});

describe('PROPOSAL-0 / A8 — remove/re-add lifetime under a pending', () => {
  it('a held reference does not retarget to a reused business key', async () => {
    const tree = plainTree();
    tree.$.rows.addOne({ id: 'a', name: 'Original' });
    await flush();

    const held = tree.$.rows.byId('a');
    expect(held?.()?.name).toBe('Original');

    tree
      .transact(() => {
        tree.$.rows.removeOne('a');
        tree.$.rows.addOne({ id: 'a', name: 'Recreated' });
      })
      .confirm();
    await flush();

    // The reused key is a DIFFERENT subject. The held reference must not
    // silently follow it.
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Recreated');
    expect(held?.()).toBeUndefined();
  });
});

describe('PROPOSAL-0 / A9 — accepted pending and restoration', () => {
  it('confirm alone adds NO undo step; undoable(confirm) adds exactly one', async () => {
    const tree = restorableTree();
    await flush();
    const base = tree.getRestorationHistory().length;

    tree
      .transact(() => {
        tree.$.name('Samuel');
      })
      .confirm();
    await flush();

    // Transactions and restoration are decoupled by design (TX-SURFACE-0).
    expect(tree.getRestorationHistory().length).toBe(base);

    undoable(() => {
      tree
        .transact(() => {
          tree.$.name('Agent');
          tree.$.priority(4);
        })
        .confirm();
    });
    await flush();

    expect(tree.getRestorationHistory().length).toBe(base + 1);

    tree.undo();
    await flush();

    // One logical operation reverses as one unit.
    expect({ name: tree.$.name(), priority: tree.$.priority() }).toEqual({
      name: 'Samuel',
      priority: 0,
    });
  });
});

describe('PROPOSAL-0 / A10 — two pendings outstanding at once', () => {
  it('independent handles settle independently', async () => {
    const tree = plainTree();
    await flush();

    const first = tree.transact(() => {
      tree.$.name('FromA');
    });
    await flush();

    const second = tree.transact(() => {
      tree.$.priority(9);
    });
    await flush();

    // The review-UI requirement: one pending outstanding while other work
    // continues. Code-supported but previously unpinned by any test.
    expect({ name: tree.$.name(), priority: tree.$.priority() }).toEqual({
      name: 'FromA',
      priority: 9,
    });

    expect(tryRollback(first)).toBe(false);
    second.confirm();
    await flush();

    expect({ name: tree.$.name(), priority: tree.$.priority() }).toEqual({
      name: '',
      priority: 9,
    });
  });
});
