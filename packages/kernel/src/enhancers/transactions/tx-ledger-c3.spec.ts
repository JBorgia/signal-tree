import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/**
 * TX-LEDGER C3 — admission by causal EFFECT, not by authorship.
 *
 * > NULL: the existing transaction dependency machinery is sufficient; only its
 * > admission criterion is wrong. A later effect becomes rollback-relevant
 * > because it depends on speculative state, not because it was authored.
 *
 * Measured cause: `getPendingRollbackPlan()` draws its later effects from
 * `confirmedTurns`, and the capture path returns early on
 * `getWriteParticipation(meta) === 'realized'` — so a server refresh is never a
 * later effect at all, and a rollback deletes the row it wrote to.
 *
 * The criterion being implemented is deliberately stronger than "include
 * realizations":
 *
 *   WRONG  authored effects count, and realization effects also count
 *   RIGHT  later effects that rely on structural facts the rollback proposes to
 *          invalidate count, whatever their origin
 *
 * The weaker form would need a new exception for the next causal origin.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

const refusalKind = (error: unknown): unknown =>
  (error as { cause?: { kind?: unknown } })?.cause?.kind;

const attempt = (fn: () => void): unknown => {
  try {
    fn();
    return 'no-refusal';
  } catch (error) {
    return refusalKind(error);
  }
};

const makeTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      unrelated: 0,
    },
    { enhancers: [transactions()] }
  );

describe('TX-LEDGER C3 case 1: dependent realization must REFUSE', () => {
  it('a server refresh on the speculative row protects it from rollback', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    realization(() => tree.$.rows.updateOne('a', { name: 'FromServer' }));
    await flush();

    // The known failure: rollback used to proceed and delete a row the server
    // had just written to — RESTORE-P0 P0-C one layer up.
    expect(attempt(() => pending.rollback())).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('FromServer');
  });
});

describe('TX-LEDGER C3 case 2: UNRELATED realization stays legal', () => {
  it('a realization elsewhere does not block rollback', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    realization(() => tree.$.unrelated(1));
    await flush();

    // Without this, "a realization happened later" would become the rule and
    // every server refresh anywhere would wedge every open transaction.
    expect(attempt(() => pending.rollback())).toBe('no-refusal');
    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.$.unrelated()).toBe(1);
  });

  it('nor does a realization on a DIFFERENT subject', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([{ id: 'other', name: 'Other' }]);
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    realization(() => tree.$.rows.updateOne('other', { name: 'Refreshed' }));
    await flush();

    expect(attempt(() => pending.rollback())).toBe('no-refusal');
    expect(tree.$.rows.ids()).toEqual(['other']);
    expect(tree.$.rows.byId('other')?.()?.name).toBe('Refreshed');
  });
});

describe('TX-LEDGER C3 cases 3 and 4: the authored controls are UNCHANGED', () => {
  it('3 — an authored dependent write still refuses', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    tree.$.rows.updateOne('a', { name: 'Edited' });
    await flush();

    // Realization handling must not be bought by weakening the case that was
    // already correct.
    expect(attempt(() => pending.rollback())).toBe('later-confirmed-dependency');
  });

  it('4 — an authored unrelated write is still legal', async () => {
    const tree = makeTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    tree.$.unrelated(1);
    await flush();

    expect(attempt(() => pending.rollback())).toBe('no-refusal');
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('TX-LEDGER C3 case 5: ORIGIN EQUIVALENCE', () => {
  it('the same dependency gives the same disposition either way', async () => {
    const build = async (viaRealization: boolean) => {
      const tree = makeTree();
      await flush();
      const pending = tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      });
      await flush();

      const write = () => tree.$.rows.updateOne('a', { name: 'Later' });
      if (viaRealization) realization(write);
      else write();
      await flush();

      return attempt(() => pending.rollback());
    };

    // THE POINT OF THE WHOLE CHANGE. Construct one structural dependency two
    // ways; the answer must not depend on who wrote it. If these differ, the
    // ledger is still answering an authorship question.
    expect(await build(true)).toBe(await build(false));
  });
});

describe('TX-LEDGER C3 case 6: LIFETIME', () => {
  it('dependency evidence does not outlive the transaction that needed it', async () => {
    const tree = makeTree();
    await flush();

    const first = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();
    realization(() => tree.$.rows.updateOne('a', { name: 'FromServer' }));
    await flush();

    expect(attempt(() => first.rollback())).toBe('later-confirmed-dependency');
    first.confirm();
    await flush();

    // A NEW transaction on the same subject must not inherit the old evidence.
    const second = tree.transaction(() => {
      tree.$.rows.updateOne('a', { name: 'Second' });
    });
    await flush();

    // Nothing has happened since `second` opened, so its rollback is legal. If
    // this refuses, the ledger has quietly become a retained causal history
    // rather than a bounded projection.
    expect(attempt(() => second.rollback())).toBe('no-refusal');
    expect(tree.$.rows.byId('a')?.()?.name).toBe('FromServer');
  });
});
