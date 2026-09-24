import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { undoable } from '../../lib/undoable';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * PROPOSAL-0 — the frozen facade, exercised through the PUBLIC surface.
 *
 * The adversarial matrix was already run against the raw primitives in
 * `pending-0-kernel.spec.ts` BEFORE this facade existed. This file re-runs
 * the load-bearing cases through `pending()` and asserts the two surfaces
 * agree — which is what makes "naming, not new semantics" checkable rather
 * than merely claimed. The lower-level transaction specs stay: if these two
 * ever disagree, the facade grew a rule of its own.
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

const tree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      name: '',
      priority: 0,
      untouched: 'safe',
    },
    { enhancers: [transactions()] }
  );

const restorable = () =>
  signalTree(
    { name: '', priority: 0 },
    { enhancers: [restoration({ maxHistorySize: 50 }), transactions()] }
  );

describe('PROPOSAL-0 facade / accept', () => {
  it('speculative value is readable before accept and survives it', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
    });
    await flush();

    expect(t.$.name()).toBe('Samuel');
    pending.confirm();
    const result = pending.inspect();
    await flush();

    expect(t.$.name()).toBe('Samuel');
    expect(result.changes).toEqual([{ path: 'name', address: ['name'], status: 'current' }]);
  });
});

describe('PROPOSAL-0 facade / reject', () => {
  it('withdraws every field through the same references', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
      t.$.priority(3);
    });
    await flush();

    t.$.untouched('edited-by-human');
    await flush();

    expect(tryRollback(pending)).toBe(false);
    expect({ name: t.$.name(), priority: t.$.priority() }).toEqual({
      name: '',
      priority: 0,
    });
    expect(t.$.untouched()).toBe('edited-by-human');
  });
});

describe('PROPOSAL-0 facade / inspect', () => {
  it('reports current vs superseded while the pending is outstanding', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('FromAgent');
      t.$.priority(3);
    });
    await flush();

    expect(pending.inspect().changes).toEqual([
      { path: 'name', address: ['name'], status: 'current' },
      { path: 'priority', address: ['priority'], status: 'current' },
    ]);

    realization(() => t.$.name('FromServer'));
    await flush();

    expect(pending.inspect().changes).toEqual([
      { path: 'name', address: ['name'], status: 'superseded' },
      { path: 'priority', address: ['priority'], status: 'current' },
    ]);
  });

  it('a structural add stays current under a later field update', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => t.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    // 'current' = the pending's CONTRIBUTION stands, not the proposed value.
    expect(pending.inspect().changes).toEqual([
      { path: 'rows.A', address: ['rows'], subject: expect.any(Number), status: 'current' },
    ]);
    expect(t.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });

  it('a structural add is superseded when a DIFFERENT subject takes the key', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    // Captured BEFORE the key is taken over. This is the whole reason
    // `subject` exists: the reported identity must stay the PROPOSAL's retired
    // subject, not silently become the new occupant's. `expect.any(Number)`
    // passes either way and so cannot detect that confusion — a relative
    // comparison is counter-independent without being blind.
    const proposedSubject = pending.inspect().changes[0]?.subject;
    expect(proposedSubject).toEqual(expect.any(Number));

    realization(() => {
      t.$.rows.removeOne('A');
      t.$.rows.addOne({ id: 'A', name: 'FromServer' });
    });
    await flush();

    expect(pending.inspect().changes).toEqual([
      {
        path: 'rows.A',
        address: ['rows'],
        subject: proposedSubject,
        status: 'superseded',
      },
    ]);
  });
});

describe('PROPOSAL-0 facade / accept closes the inspect race', () => {
  it('the returned acceptance reports settlement, not the earlier read', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('FromAgent');
    });
    await flush();

    const early = pending.inspect();
    expect(early.changes).toEqual([{ path: 'name', address: ['name'], status: 'current' }]);

    // Newer truth lands between the reviewer reading and acting.
    realization(() => t.$.name('FromServer'));
    await flush();

    pending.confirm();
    const result = pending.inspect();

    expect(result.changes).toEqual([{ path: 'name', address: ['name'], status: 'superseded' }]);
    // And the acceptance snapshot is stable afterwards.
    expect(pending.inspect()).toEqual(result);
  });
});

describe('PROPOSAL-0 facade / restoration stays orthogonal', () => {
  it('accept() alone enrolls NOTHING', async () => {
    const t = restorable();
    await flush();
    const base = t.getRestorationHistory().length;

    t.transact(() => {
      t.$.name('Samuel');
    }).confirm();
    await flush();

    expect(t.getRestorationHistory().length).toBe(base);
  });

  it('undoable() around the PROPOSAL enrolls one unit, across a review gap', async () => {
    const t = restorable();
    await flush();
    const base = t.getRestorationHistory().length;

    t.transact(() => {
      t.$.name('Samuel');
    }).confirm();
    await flush();

    let pending!: ReturnType<typeof t.propose>;
    undoable(() => {
      pending = t.transact(() => {
        t.$.name('Agent');
        t.$.priority(4);
      });
    });

    // The review gap: designation is declared at pending time and must
    // survive an arbitrary delay before the human acts.
    await flush();
    await flush();
    await flush();

    pending.confirm();
    await flush();

    expect(t.getRestorationHistory().length).toBe(base + 1);

    t.undo();
    await flush();
    expect({ name: t.$.name(), priority: t.$.priority() }).toEqual({
      name: 'Samuel',
      priority: 0,
    });
  });

  // GUARD 1 — early designation must not mean early history.
  it('a designated pending that is still PENDING has no completed entry', async () => {
    const t = restorable();
    await flush();
    const base = t.getRestorationHistory().length;

    let pending!: ReturnType<typeof t.propose>;
    undoable(() => {
      pending = t.transact(() => {
        t.$.name('Agent');
      });
    });
    await flush();

    expect(t.getRestorationHistory().length).toBe(base);
    expect(pending.inspect().changes).toEqual([
      { path: 'name', address: ['name'], status: 'current' },
    ]);
  });

  // GUARD 2 — early designation must not leave residue after rejection.
  it('a designated pending that is REJECTED leaves no entry behind', async () => {
    const t = restorable();
    await flush();
    const base = t.getRestorationHistory().length;

    let pending!: ReturnType<typeof t.propose>;
    undoable(() => {
      pending = t.transact(() => {
        t.$.name('Agent');
        t.$.priority(4);
      });
    });
    await flush();

    pending.rollback();
    await flush();

    expect(t.getRestorationHistory().length).toBe(base);
    expect({ name: t.$.name(), priority: t.$.priority() }).toEqual({
      name: '',
      priority: 0,
    });
  });
});

describe('PROPOSAL-0 facade / reject refusal is not swallowed', () => {
  it('throws when the reversal would destroy newer truth', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => t.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    expect(tryRollback(pending)).toBe('later-confirmed-dependency');
    expect(t.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });
});

describe('PROPOSAL-0 facade / two pendings outstanding', () => {
  it('independent handles settle independently', async () => {
    const t = tree();
    await flush();

    const first = t.transact(() => {
      t.$.name('FromA');
    });
    await flush();
    const second = t.transact(() => {
      t.$.priority(9);
    });
    await flush();

    expect(tryRollback(first)).toBe(false);
    second.confirm();
    await flush();

    expect({ name: t.$.name(), priority: t.$.priority() }).toEqual({
      name: '',
      priority: 9,
    });
  });
});

describe('PROPOSAL-0 facade / equivalence with the raw primitives', () => {
  it('pending+accept and transaction+confirm reach the same state', async () => {
    const viaFacade = tree();
    const viaRaw = tree();
    await flush();

    viaFacade
      .transact(() => {
        viaFacade.$.name('X');
        viaFacade.$.rows.addOne({ id: 'A', name: 'Alpha' });
      })
      .confirm();

    viaRaw
      .transact(() => {
        viaRaw.$.name('X');
        viaRaw.$.rows.addOne({ id: 'A', name: 'Alpha' });
      })
      .confirm();
    await flush();

    expect(viaFacade.$()).toEqual(viaRaw.$());
  });

  it('pending+reject and transaction+rollback reach the same state', async () => {
    const viaFacade = tree();
    const viaRaw = tree();
    await flush();

    const p = viaFacade.transact(() => {
      viaFacade.$.name('X');
      viaFacade.$.rows.addOne({ id: 'A', name: 'Alpha' });
    });
    const r = viaRaw.transact(() => {
      viaRaw.$.name('X');
      viaRaw.$.rows.addOne({ id: 'A', name: 'Alpha' });
    });
    await flush();

    p.rollback();
    r.rollback();
    await flush();

    expect(viaFacade.$()).toEqual(viaRaw.$());
  });
});

// ───────────────────────── double settlement ─────────────────────────
//
// Inherited wholesale from the pending-transaction lifecycle: repeats are
// idempotent, cross-transitions throw, and a REFUSED rejection leaves the
// pending still pending because the refusal is raised before the lifecycle
// moves. No pending-only rule — these pin that the facade adds none.

describe('PROPOSAL-0 facade / double settlement', () => {
  it('accept() twice is idempotent and returns a stable snapshot', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
    });
    await flush();

    pending.confirm();
    const first = pending.inspect();
    pending.confirm();
    const second = pending.inspect();

    expect(second).toEqual(first);
    expect(t.$.name()).toBe('Samuel');
  });

  it('reject() twice is idempotent', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
    });
    await flush();

    pending.rollback();
    expect(() => pending.rollback()).not.toThrow();
    expect(t.$.name()).toBe('');
  });

  it('reject() after accept() throws and does not alter state', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
    });
    await flush();

    pending.confirm();
    expect(() => pending.rollback()).toThrow(
      /Cannot rollback a confirmed transaction/
    );
    expect(t.$.name()).toBe('Samuel');
  });

  it('accept() after reject() throws and does not alter state', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.name('Samuel');
    });
    await flush();

    pending.rollback();
    expect(() => pending.confirm()).toThrow(
      /Cannot confirm a rolled back transaction/
    );
    expect(t.$.name()).toBe('');
  });

  it('a REFUSED reject leaves the pending still acceptable', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => t.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    // The refusal is raised BEFORE the lifecycle moves, so this is still a
    // live pending — a review UI can offer reconcile-then-accept.
    expect(tryRollback(pending)).toBe('later-confirmed-dependency');

    pending.confirm();
    const settled = pending.inspect();
    expect(settled.changes).toEqual([{ path: 'rows.A', address: ['rows'], subject: expect.any(Number), status: 'current' }]);
    expect(t.$.rows.byId('A')?.()?.name).toBe('FromServer');
  });

  it('inspect() after a refused reject still reads live, not frozen', async () => {
    const t = tree();
    await flush();

    const pending = t.transact(() => {
      t.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => t.$.rows.updateOne('A', { name: 'FromServer' }));
    await flush();

    expect(tryRollback(pending)).toBe('later-confirmed-dependency');
    expect(pending.inspect().changes).toEqual([
      { path: 'rows.A', address: ['rows'], subject: expect.any(Number), status: 'current' },
    ]);

    // Newer truth arriving after the refusal must still be observed.
    realization(() => t.$.rows.removeOne('A'));
    await flush();

    expect(pending.inspect().changes).toEqual([
      { path: 'rows.A', address: ['rows'], subject: expect.any(Number), status: 'superseded' },
    ]);
  });
});
