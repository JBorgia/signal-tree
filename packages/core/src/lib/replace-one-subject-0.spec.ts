import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * REPLACE-ONE-SUBJECT-0 — ⚠️ A SEPARATE P0, FOUND BY THE REAL-WHOLE-EFFECT-0
 * TRAFFIC INVENTORY, AND IT IS NOT THE NESTED DEFECT.
 *
 * `replaceOne` emits reversal effects with **no SubjectId at all**, while the
 * operations either side of it emit one. Measured on a TOP-LEVEL collection:
 *
 * ```text
 * upsertOne existing  subj=1          path=rows.r1.name / rows.r1.n
 * setAll replacing    subj=1          path=rows.r1.name / rows.r1.n
 * replaceOne          subj=undefined  path=rows.r1.name / rows.r1.n   <- HERE
 * ```
 *
 * All three are the same semantic operation — replace the state of an existing
 * subject — and all three decompose into the same per-field effects. Only
 * `replaceOne` drops subject identity.
 *
 * ## ⚠️ Why this matters beyond a missing field
 *
 * ```text
 * transaction rollback  "SignalTree could not rollback the pending transaction"
 * undoable() + undo     "Unsupported scoped undo effect at structural-drift"
 * ```
 *
 * **This is a TOP-LEVEL failure.** Every previously recorded rollback defect in
 * this class was nested-only, and all five expected failures are nested. So this
 * is not covered by them, and it is not explained by the inline collection
 * derivation (`parentPath('data.rows') -> 'data'`) either — at top level that
 * derivation is correct.
 *
 * The mechanism is upstream of address derivation entirely: with no SubjectId,
 * `hasInlineSubjectAddress` is false, so no inline subject address is derived,
 * and subject resolution cannot key a fallback descriptor either.
 *
 * ⚠️ Recorded, NOT fixed. It is a distinct defect from the nested collection
 * rollback, it was found while answering a different question, and the standing
 * instruction is one production correction at a time. Fixing it opportunistically
 * inside the address repair would confound both.
 *
 * These tests pin CURRENT behaviour. When `replaceOne` is repaired they fail and
 * must be rewritten to assert successful rollback — that failure is the intended
 * signal, not a regression.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; name: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r: Row) => r.id });

type Rows = {
  addOne(r: Row): void;
  upsertOne(r: Row): void;
  replaceOne(id: string, r: Row): void;
  byIdOrFail(id: string): {
    name: { (): string; set(v: string): void };
    n: { (): number; set(v: number): void };
  };
  ids(): string[];
};

const topTree = () =>
  signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }) as unknown as {
    $: { rows: Rows };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
    undo?: () => void;
  };

const seeded = async () => {
  const tree = topTree();
  await flush();
  tree.$.rows.addOne({ id: 'r1', name: 'orig', n: 1 });
  await flush();
  return tree;
};

describe('REPLACE-ONE-SUBJECT-0: top-level replaceOne cannot roll back', () => {
  it('⚠️ KNOWN RED — transaction rollback REFUSES at TOP level', async () => {
    const tree = await seeded();

    const p = tree.transaction(() =>
      tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');

    let threw = false;
    try {
      p.rollback();
    } catch {
      threw = true;
    }
    await flush();

    expect(threw).toBe(true);
    // The speculative state stays materialized — same disposition class as the
    // nested defect, but reached by a different mechanism.
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(99);
  });

  it('⚠️ KNOWN RED — undo REFUSES at TOP level too', async () => {
    const tree = await seeded();

    undoable(() => tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 }));
    await flush();

    try {
      tree.undo?.();
    } catch {
      /* refusal is the measured behaviour */
    }
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');
  });

  it('THE CONTROL — upsertOne over the same subject DOES roll back', async () => {
    const tree = await seeded();

    // Same semantic operation, same decomposition, same top-level shape. The
    // only measured difference is that this one carries subj=1. Without this
    // control the two cases above could be blamed on the collection, the
    // enhancers, or the harness.
    const p = tree.transaction(() =>
      tree.$.rows.upsertOne({ id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });
});
