import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../restoration/restoration';
import { transactions } from '../transactions/transactions';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';

/**
 * DEVTOOLS-JUMP-0 — what KIND of state application is a DevTools jump?
 *
 * `devTools()` handles JUMP_TO_STATE / JUMP_TO_ACTION / ROLLBACK / COMMIT /
 * IMPORT_STATE by calling `applyState()` directly under
 * `withWriteContext({ intent: 'system', origin: 'devtools' })` — no
 * `participation`, and no routing through the restoration authority.
 *
 * Pre-registered possibilities:
 *
 *   A  authored participation — current semantics are intentional
 *   B  realization participation — it applies already-selected inspection state
 *      rather than newly authored work
 *   C  it is RESTORATION and must route through the restoration authority
 *   D  neither product restoration nor ordinary realization — a distinct
 *      inspection application needing its own participation semantic
 *   U  the evidence does not discriminate
 *
 * C is the one the "single restoration authority" rule would demand, and the
 * reason to doubt it is that a scrub is not asking *reverse one previously
 * designated operation legally* — it is asking *show the tree as this snapshot*.
 * Restoration carries designation, validity, refusal and claim semantics that
 * arbitrary snapshot inspection does not satisfy.
 *
 * So the discriminating evidence is not philosophical. It is the TRANSACTION
 * interaction: if a diagnostic inspection action is swallowed into application
 * business work, that is a wrong ownership relationship regardless of what we
 * call it.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/**
 * The context `devTools()` established at the time of this experiment: a
 * devtools origin with DEFAULT (authored) participation.
 *
 * Kept verbatim rather than updated, because the findings below ARE the
 * behaviour of that context and are what closed the disposition as D. The
 * post-fix contract — `participation: 'inspection'` — is measured in
 * `devtools-jump-0-1.spec.ts`, which is the acceptance file.
 */
const asAuthoredDevtools = (fn: () => void) =>
  withWriteContext({ intent: 'system', origin: 'devtools' }, fn);

describe('DEVTOOLS-JUMP-0: interaction with a PENDING transaction', () => {
  it('is a devtools application captured into the transaction contribution?', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
      { enhancers: [timeTravel(), transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // A scrub landing mid-transaction. Nobody authored it; the developer moved a
    // slider.
    asAuthoredDevtools(() => tree.$.n.set(42));
    await flush();

    pending.rollback();
    await flush();

    // MEASURED: 42 survives. The inspection write is NOT compensated, so it was
    // not captured into the transaction's contribution.
    //
    // ⚠️ And note WHY, because it is not a designed guarantee: `withWriteContext`
    // REPLACES the ambient context, and the transaction callback has already
    // returned by the time the scrub happens — so there is no `transactionId` in
    // scope to route it into the bucket. A scrub landing DURING the callback is a
    // different question this case does not reach.
    expect(tree.$.n()).toBe(42);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('does a devtools application create rollback DEPENDENCY evidence?', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // Touching the speculative row through the devtools door.
    asAuthoredDevtools(() => tree.$.rows.updateOne('a', { name: 'Inspected' }));
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // ⚠️ THE DISCRIMINATING RESULT. A diagnostic inspection BLOCKS a business
    // rollback: the scrub became later-confirmed dependency evidence, the
    // rollback was refused, and the speculative row survives.
    //
    // A developer moving a DevTools slider has changed what the application is
    // permitted to do. That is a wrong ownership relationship whatever the
    // participation is called.
    //
    // And note what it rules out: flipping devtools to REALIZATION participation
    // would not fix it, because C3 deliberately admits later effects by causal
    // effect REGARDLESS of origin. Only a participation that is excluded from
    // dependency admission fixes this — which is possibility D, not B.
    expect(refusal).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
  });
});

describe('DEVTOOLS-JUMP-0: interaction with restoration', () => {
  it('does a devtools application become an undo step?', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    undoable(() => tree.$.n.set(1));
    await flush();
    const historyAfterAuthored = tree.getRestorationHistory().length;

    asAuthoredDevtools(() => tree.$.n.set(99));
    await flush();

    // Under opt-in it cannot be admitted — it was never designated — so this
    // should hold for a reason that has nothing to do with devtools.
    expect(tree.getRestorationHistory().length).toBe(historyAfterAuthored);

    // And the undo reverses the authored turn, overwriting the scrub — 99 is
    // gone and n is back to 0.
    //
    // Consistent with a scrub being INSPECTION rather than truth: P0-C protects
    // later EXTERNAL truth from being discarded by an undo, and it protects it by
    // recording realization-participating writes. An authored-participating
    // devtools write is not recorded, so it is not protected. If a scrub were
    // reclassified as realization it WOULD become protected — which would mean an
    // inspection action could refuse a legitimate undo. Another reason B is not
    // obviously right.
    tree.undo();
    await flush();
    expect(tree.$.n()).toBe(0);
  });
});
