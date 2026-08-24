import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { withWriteContext } from '../../lib/write-context';

/**
 * DEVTOOLS-JUMP-0.1 — acceptance for `participation: 'inspection'`.
 *
 * DEVTOOLS-JUMP-0 closed as D: a DevTools state application is INSPECTION —
 * not authorship, not realization, not restoration. Two holes remained:
 *
 *   1. The exclusion from transaction CONTRIBUTION was only measured for a
 *      scrub landing AFTER the callback returned, where it holds for an
 *      incidental reason (`withWriteContext` replaces the ambient context, so
 *      no `transactionId` is in scope). The synchronous-in-callback case was
 *      never measured.
 *   2. The exclusion from DEPENDENCY admission does not exist at all: a scrub
 *      touching a speculative row refuses the rollback.
 *
 * This file measures both, then pins them as acceptance criteria.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/**
 * The context `devTools()` establishes before calling applyState() — now
 * including the declared participation. Reproduced here rather than driven
 * through the Redux bridge, so the semantics are measured without a browser
 * extension. `devtools-impl.ts` is the site of record.
 */
const asDevtools = (fn: () => void) =>
  withWriteContext(
    { intent: 'system', source: 'devtools', causalMode: 'inspection' },
    fn
  );

describe('DEVTOOLS-JUMP-0.1: inspection DURING a transaction callback', () => {
  it('is a synchronous in-callback scrub captured into the contribution?', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      // The developer scrubs WHILE the transaction is open. Transaction context
      // exists in this frame — so if exclusion is incidental rather than
      // designed, this is where it breaks.
      asDevtools(() => tree.$.n.set(42));
    });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // The rollback succeeds and reverses ONLY the authored work. The scrub
    // survives at 42 because it was never part of the contribution — now for a
    // declared reason rather than an incidental one: the capture sites return
    // before any bucket is touched, whether or not a `transactionId` is in
    // scope.
    expect(refusal).toBe('no-refusal');
    expect(tree.$.n()).toBe(42);
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('does an in-callback scrub of the SPECULATIVE row refuse the rollback?', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      asDevtools(() => tree.$.rows.updateOne('a', { name: 'Inspected' }));
    });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // No refusal, and the speculative row is gone. Inspecting a speculative row
    // does not give the inspection a stake in whether it may be withdrawn.
    expect(refusal).toBe('no-refusal');
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('DEVTOOLS-JUMP-0.1: inspection is not a causal eraser', () => {
  it('an AUTHORED write after a scrub still creates dependency evidence', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // Inspection first — which must contribute nothing.
    asDevtools(() => tree.$.rows.updateOne('a', { name: 'Inspected' }));
    await flush();
    // Then an ordinary authored consequence of having looked. This one is
    // classified on ITS OWN terms and MUST still create dependency evidence:
    // "inspection" may not launder a later authored write.
    tree.$.rows.updateOne('a', { name: 'Authored' });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    await flush();

    // ⚠️ THE PIN. Still refused. The scrub contributed nothing, but the authored
    // write that FOLLOWED it is classified on its own terms and creates
    // dependency evidence normally.
    //
    // Without this, `inspection` would be a laundering channel: touch a
    // speculative row through the devtools door, then author freely against it
    // and claim the rollback is unblocked. Inspection excuses the inspection —
    // nothing downstream of it.
    expect(refusal).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
  });
});

describe('DEVTOOLS-JUMP-0.1: the ledger hole', () => {
  it('a LATER scrub of a speculative row no longer refuses the rollback', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // The DEVTOOLS-JUMP-0 defect, verbatim: this refused before inspection
    // participation existed, because TX-LEDGER C3 admits LATER effects by causal
    // effect regardless of origin.
    asDevtools(() => tree.$.rows.updateOne('a', { name: 'Inspected' }));
    await flush();

    expect(() => pending.rollback()).not.toThrow();
    await flush();
    expect(tree.$.rows.ids()).toEqual([]);
  });

  it('CONTROL — the same write in REALIZATION participation still refuses', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    });
    await flush();

    // Identical write, identical timing, different participation. Proves the
    // exclusion above is the participation doing the work and not the timing —
    // and that C3 is intact for the case it was built for: truth another
    // authority has a right to preserve.
    withWriteContext({ intent: 'system', causalMode: 'realization' }, () => {
      tree.$.rows.updateOne('a', { name: 'Server' });
    });
    await flush();

    let refusal: unknown = 'no-refusal';
    try {
      pending.rollback();
    } catch (error) {
      refusal = (error as { cause?: { kind?: unknown } })?.cause?.kind;
    }
    expect(refusal).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['a']);
  });
});
