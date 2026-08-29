import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * TX-LEDGER-0 case 6 — the architectural control, run first.
 *
 * The flip found that a pending-transaction rollback stopped refusing when a
 * later dependent write was no longer admitted to history. Before designing any
 * ledger, one question decides how large the problem is:
 *
 * > does rollback dependency safety work when `restoration()` is NOT installed?
 *
 * Required relationship:
 *
 *   transactions()  requires causal-runtime facts
 *   restoration()    requires causal-runtime facts
 *   transactions()  does NOT require restoration()
 *
 * MEASURED: it holds. `transactions()` refuses identically with and without
 * `restoration()`, and with the same refusal KIND, because it builds its
 * dependency store from ITS OWN captured effects rather than from the history.
 *
 * That scopes the category-C defect to one path — `restoration()`'s own
 * `transaction()`, whose `getPendingRollbackPlan` reads `this.history` — and
 * means a correct reference implementation already exists in this repository.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** The refusal kind, which is what distinguishes the two mechanisms. */
const refusalKind = (error: unknown): unknown =>
  (error as { cause?: { kind?: unknown } })?.cause?.kind;

describe('TX-LEDGER-0 case 6: rollback safety without restoration()', () => {
  it('refuses a dependent rollback with restoration() installed', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [restoration({ maxHistorySize: 50 }), transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // A later authored write that DEPENDS on the speculative row existing.
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

  it('THE CONTROL: refuses IDENTICALLY with transactions() alone', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
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

    // Same refusal, no restoration enhancer present. `transactions()` admits its
    // pending turn into a LOCAL TurnStore built from its own captured effects, so
    // its dependency question never consults the restoration history.
    //
    // This is the ownership property the flip put in doubt, and it holds:
    // transaction correctness does not require the restoration enhancer.
    expect(kind).toBe('later-confirmed-dependency');
  });

  it('an UNRELATED later write leaves rollback legal — the ledger is not "something happened"', async () => {
    const tree = signalTree(
      {
        rows: entityMap<Row, string>({ selectId: (r) => r.id }),
        unrelated: 0,
      },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    tree.$.unrelated.set(1);
    await flush();

    // Without this control, "refuses when a later write exists" could be
    // satisfied by a ledger that merely notices later activity.
    expect(() => pending.rollback()).not.toThrow();
    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.$.unrelated()).toBe(1);
  });
});
