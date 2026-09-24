import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/**
 * REKEY-SUPERSESSION-0 — OBSERVATION PASS. Preregistered in TODO.md.
 *
 * > Question: when newer truth has eliminated or superseded the subject/key
 * > state created by a pending rekey, can the transaction safely skip that
 * > structural compensation and reverse the rest of the turn WITHOUT
 * > resurrecting or retargeting an entity?
 *
 * Pins the five-case matrix BEFORE any rekey code changes. Rekey rollback
 * carries a documented repair history — RESTORE-P0 P0-B, `d487a4ae`, pinned by
 * `rekeyed-rollback-defect.spec.ts` — so case 4 here exists to make a
 * regression of that repair impossible to land quietly.
 *
 * Expectations record MEASURED behaviour. Nothing here asserts a desired
 * outcome.
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

const rowTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      x: 0,
    },
    { enhancers: [transactions()] }
  );

describe('REKEY-SUPERSESSION-0 / 1 — later UPDATE of the rekeyed subject', () => {
  it('already surgical: key reverts, the newer field value survives', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();

    realization(() => tree.$.rows.updateOne('A2', { name: 'FromServer' }));
    await flush();

    // NOT a conflict, deliberately: `hasSameSubjectDependency` guards later
    // `set` effects with `effect.kind !== 'rekey'`. A rekey changes the KEY,
    // a later set changes a FIELD of the same subject, so they do not contend.
    // The turn's contribution (the rename) reverses; the server's field value
    // rides along with the subject and survives.
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual(['A']);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('FromServer');
    expect(tree.$.x()).toBe(0);
  });
});

describe('REKEY-SUPERSESSION-0 / 2 — later REMOVE of the rekeyed subject', () => {
  it('completes the reversal: nothing remains to rename', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();

    realization(() => tree.$.rows.removeOne('A2'));
    await flush();

    // The subject the rekey retargeted is gone, so the compensating rename has
    // nothing to act on and nothing to resurrect. Skipping it lets the rest of
    // the turn reverse. The row stays absent because the SERVER deleted it —
    // newer truth, correctly preserved.
    //
    // Pre-fix this refused and stranded `x` at 1; see the pinning commit.
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.x()).toBe(0);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('REKEY-SUPERSESSION-0 / 3 — later REMOVE then ADD of the same key', () => {
  it('discriminator: the re-added key is a different subject', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();

    realization(() => {
      tree.$.rows.removeOne('A2');
      tree.$.rows.addOne({ id: 'A2', name: 'FromServer' });
    });
    await flush();

    const refusal = tryRollback(pending);

    // THE INVARIANT: the newly created subject must survive untouched. It
    // reuses the business key but is a different subject, so the turn's
    // compensation cannot reach it.
    expect(tree.$.rows.byId('A2')?.()?.name).toBe('FromServer');

    // Lifetime separation makes reversing the rest safe, so it does.
    expect({ refusal, x: tree.$.x(), ids: tree.$.rows.ids() }).toEqual({
      refusal: false,
      x: 0,
      ids: ['A2'],
    });
  });
});

describe('REKEY-SUPERSESSION-0 / 4 — clean rekey, no later writer', () => {
  it('RESTORE-P0 P0-B: rolls back to the ORIGINAL key, unchanged', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
    });
    await flush();

    expect(tree.$.rows.ids()).toEqual(['A2']);

    // The guard against regressing the documented repair.
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual(['A']);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('Original');
    expect(tree.$.x()).toBe(0);
  });
});

describe('REKEY-SUPERSESSION-0 / 5 — rekey plus another structural operation', () => {
  it('RESTORE-P0 P0-B: rekey then remove still rolls back to the original key', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'Original' });
    await flush();

    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'A2');
      tree.$.rows.removeOne('A2');
    });
    await flush();

    expect(tree.$.rows.ids()).toEqual([]);

    // The exact composition the repair fixed. Must stay green through any
    // supersession change.
    expect(tryRollback(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual(['A']);
    expect(tree.$.x()).toBe(0);
  });
});
