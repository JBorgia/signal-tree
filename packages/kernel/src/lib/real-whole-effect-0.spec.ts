import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * REAL-WHOLE-EFFECT-0 — does any REAL `ReversalEffect` require WHOLE-subject
 * scalar targeting?
 *
 * ```text
 * NULL       at least one real non-structural ReversalEffect requires
 *            WHOLE-subject scalar targeting
 * FALSIFIER  all real non-structural subject effects are FIELD-addressed;
 *            WHOLE exists only in descriptor/notification derivation and is
 *            never required by an actual ReversalEffect
 * ```
 *
 * ## RESULT — the NULL IS FALSIFIED. OUTCOME A.
 *
 * Every `ReversalEffect` reaching `validateEffects` / `applyAtomically` was
 * captured across the full operation matrix. **Not one non-structural effect
 * addresses a whole subject.** Every one is a field coordinate carrying a
 * SCALAR before/after — never a row object:
 *
 * ```text
 * updateOne 1 field   subj=1 path=rows.r1.n     before=number:99  after=number:1
 * updateOne 2 fields  subj=1 path=rows.r1.name  before=string:"X" after=string:"name-r1"
 *                     subj=1 path=rows.r1.n     before=number:99  after=number:1
 * replaceOne          path=rows.r1.name / rows.r1.n   (scalars)
 * upsertOne existing  subj=1 path=rows.r1.name / rows.r1.n
 * setAll replacing    subj=1 path=rows.r1.name / rows.r1.n
 * ```
 *
 * Every whole-entity-looking operation DECOMPOSES into per-field effects. And
 * every lifetime transition is structural and ADDRESSLESS:
 *
 * ```text
 * addOne / addMany / upsertOne new   struct=remove  path=undefined
 * removeOne / clear                  struct=add     path=undefined
 * changeId                           struct=rekey   path=undefined
 * ```
 *
 * ⚠️ **So SUBJECT-ADDRESS-0 asked the right question at the wrong layer.** `''`
 * is produced by DESCRIPTOR/NOTIFICATION derivation, and that finding stands as
 * a fact about that layer. But no `ReversalEffect` ever needs it. The two layers
 * were conflated, and the effect layer is the one the repair targets.
 *
 * ## Consequence — do NOT put WHOLE in the effect representation
 *
 * ```text
 * subject scalar effect   FIELD(path)
 * absence                 not a subject scalar effect / structural
 * ```
 *
 * No `{ kind: 'whole' }` on `ReversalEffect`. The subject effect identity is:
 *
 * ```text
 * owner PositionId  -> canonical collection (registry)
 * SubjectId         -> current entity lifetime / key
 * fieldPath         -> coordinate inside the entity
 * ```
 *
 * with `structuralContext` handling existence, membership and rekey. Carrying an
 * unneeded WHOLE state into the new causal type would preserve a representation
 * that nothing in real reversal traffic requires.
 *
 * ## The tests below assert the OBSERVABLE consequence
 *
 * Effect internals are not public, so these pin the behaviour that decomposition
 * implies: a whole-entity operation restores field-by-field, and partial-field
 * granularity survives rollback. If any operation ever started emitting a single
 * whole-row effect, the sibling-field case would change.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; name: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r: Row) => r.id });

type Rows = {
  addOne(r: Row): void;
  updateOne(id: string, patch: Partial<Row>): void;
  upsertOne(r: Row): void;
  setAll(r: Row[]): void;
  byIdOrFail(id: string): {
    name: { (value: string): void; (update: (current: string) => string): void; (): string };
    n: { (value: number): void; (update: (current: number) => number): void; (): number };
  };
  ids(): string[];
};

const topTree = () =>
  signalTree({ rows: em() }, { enhancers: [restoration(), transactions()] }) as unknown as {
    $: { rows: Rows };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

const seeded = async () => {
  const tree = topTree();
  await flush();
  tree.$.rows.addOne({ id: 'r1', name: 'orig', n: 1 });
  await flush();
  return tree;
};

describe('REAL-WHOLE-EFFECT-0: whole-entity ops decompose into field effects', () => {
  it('upsertOne over an existing subject rolls back field-by-field', async () => {
    const tree = await seeded();

    const p = tree.transaction(() =>
      tree.$.rows.upsertOne({ id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(99);

    p.rollback();
    await flush();

    // Both fields restore, and the subject was never destroyed and recreated —
    // which is what "decomposes into field effects" means observably.
    expect(tree.$.rows.ids()).toEqual(['r1']);
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('setAll replacing an existing subject also rolls back field-by-field', async () => {
    const tree = await seeded();

    const p = tree.transaction(() =>
      tree.$.rows.setAll([{ id: 'r1', name: 'changed', n: 99 }])
    );
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['r1']);
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('⚠️ a sibling field written OUTSIDE the transaction is NOT reverted', async () => {
    const tree = await seeded();

    // The discriminator. If updateOne produced ONE whole-row effect, rolling it
    // back would restore the entire row and clobber this sibling write. It does
    // not, because the effects are per-field.
    const p = tree.transaction(() => tree.$.rows.updateOne('r1', { n: 99 }));
    await flush();
    tree.$.rows.byIdOrFail('r1').name('written-outside');
    await flush();

    p.rollback();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1); // reverted
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('written-outside'); // untouched
  });
});
