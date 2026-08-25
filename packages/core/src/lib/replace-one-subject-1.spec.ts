import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import { getOwnedSubjectIds } from './internals/owned-metadata';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * REPLACE-ONE-SUBJECT-1 — the fix, and the finding it closes.
 *
 * ## REPLACE-ONE-SUBJECT-0, the finding
 *
 * Found by the REAL-WHOLE-EFFECT-0 traffic inventory, not sought. `replaceOne`
 * emitted reversal effects with **no SubjectId**, while the operations either
 * side of it emitted one for the same semantic operation:
 *
 * ```text
 * upsertOne existing  subj=1          path=rows.r1.name / rows.r1.n
 * setAll replacing    subj=1          path=rows.r1.name / rows.r1.n
 * replaceOne          subj=undefined  path=rows.r1.name / rows.r1.n
 * ```
 *
 * ```text
 * transaction rollback  "SignalTree could not rollback the pending transaction"
 * undoable() + undo     "Unsupported scoped undo effect at structural-drift"
 * ```
 *
 * ⚠️ A **TOP-LEVEL** failure, so not covered by the nested batteries, and not
 * the inline collection derivation either — that is correct at top level. The
 * mechanism was upstream of address derivation entirely: with no SubjectId,
 * `hasInlineSubjectAddress` is false, no inline subject address is derived, and
 * no fallback descriptor can be keyed.
 *
 * ## REPLACE-ONE-SUBJECT-1, the repair
 *
 * ```text
 * NULL       replaceOne already knows the SubjectId and merely fails to
 *            propagate it through the channel upsertOne / setAll use
 * FALSIFIER  it lacks the identity at its producer boundary and needs a new
 *            lookup mechanism
 * ```
 *
 * **The NULL SURVIVES.** `replaceOne` resolves
 * `structuralStore.subjectIdForKey(id)` and THROWS if it is missing — it has had
 * the identity all along. It then passed `undefined` to `pathNotifier.notify`'s
 * `subjectIds` parameter, the only entity notification in `entity-signal.ts`
 * that dropped it; `updateOne`, `updateMany` and `removeOne` all pass theirs.
 *
 * The repair is that one argument. No new lookup, no path parsing, no
 * key-as-identity fallback, no realization-adapter special case.
 *
 * ## ⚠️ The replacement object's `id` is DATA, not identity
 *
 * The existing contract is explicit and is PRESERVED here:
 *
 * > "The id comes from the caller on purpose. A `setOne` deriving it via
 * > `selectId(entity)` writes to whatever slot the entity's own id field names —
 * > and `changeId` can leave `entity.id` disagreeing with the storage key."
 *
 * So `replaceOne` is deliberately NOT a rekey, and this fix does not make it
 * one. The tests below use a matching id and assert only subject IDENTITY
 * behaviour, never a new replacement-id semantic.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

type Row = { id: string; name: string; n: number };
const em = () => entityMap<Row, string>({ selectId: (r: Row) => r.id });

type Rows = {
  addOne(r: Row): void;
  upsertOne(r: Row): void;
  updateOne(id: string, patch: Partial<Row>): void;
  replaceOne(id: string, r: Row): void;
  changeId(from: string, to: string): void;
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

const nestedTree = () =>
  signalTree(
    { data: { rows: em() } },
    { enhancers: [restoration(), transactions()] }
  ) as unknown as {
    $: { data: { rows: Rows } };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
    undo?: () => void;
  };

const seed = async <T extends { $: unknown }>(tree: T, rows: (t: T) => Rows) => {
  await flush();
  rows(tree).addOne({ id: 'r1', name: 'orig', n: 1 });
  await flush();
  return tree;
};

const TOP = (t: { $: { rows: Rows } }) => t.$.rows;
const NESTED = (t: { $: { data: { rows: Rows } } }) => t.$.data.rows;

/** Internal seam — a row FIELD leaf carries the subject id. */
const subjectIdOf = (rows: Rows, key: string) =>
  getOwnedSubjectIds(rows.byIdOrFail(key).name)?.[0];

describe('REPLACE-ONE-SUBJECT-1: reversal now works', () => {
  it('TOP transaction rollback restores the original fields', async () => {
    const tree = await seed(topTree(), TOP);

    const p = tree.transaction(() =>
      tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');

    p.rollback();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('TOP undo restores the original fields', async () => {
    const tree = await seed(topTree(), TOP);

    undoable(() =>
      tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('changed');

    tree.undo?.();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('NESTED transaction rollback restores the original fields', async () => {
    const tree = await seed(nestedTree(), NESTED);

    const p = tree.transaction(() =>
      tree.$.data.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 })
    );
    await flush();

    p.rollback();
    await flush();

    expect(tree.$.data.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('NESTED undo restores the original fields', async () => {
    const tree = await seed(nestedTree(), NESTED);

    undoable(() =>
      tree.$.data.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 })
    );
    await flush();

    tree.undo?.();
    await flush();

    expect(tree.$.data.rows.byIdOrFail('r1').name()).toBe('orig');
    expect(tree.$.data.rows.byIdOrFail('r1').n()).toBe(1);
  });
});

describe('REPLACE-ONE-SUBJECT-1: subject lifetime', () => {
  it('replaceOne REPLACES STATE — it does not end the subject lifetime', async () => {
    const tree = await seed(topTree(), TOP);
    const before = subjectIdOf(tree.$.rows, 'r1');

    tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 });
    await flush();

    // Same lifetime, new state. If replaceOne destroyed and recreated the
    // subject this would change, and the reversal semantics would differ.
    expect(before).toBeDefined();
    expect(subjectIdOf(tree.$.rows, 'r1')).toBe(before);
  });

  it('⚠️ after a rekey, reversal resolves the SubjectId to the CURRENT key', async () => {
    const tree = await seed(topTree(), TOP);
    const original = subjectIdOf(tree.$.rows, 'r1');

    tree.$.rows.changeId('r1', 'r9');
    await flush();

    // Same subject, new key — the identity that must survive.
    expect(subjectIdOf(tree.$.rows, 'r9')).toBe(original);

    const p = tree.transaction(() =>
      tree.$.rows.replaceOne('r9', { id: 'r9', name: 'changed', n: 99 })
    );
    await flush();
    p.rollback();
    await flush();

    // Resolved through the CURRENT key. Nothing depended on `r1` still existing.
    expect(tree.$.rows.ids()).toEqual(['r9']);
    expect(tree.$.rows.byIdOrFail('r9').name()).toBe('orig');
    expect(tree.$.rows.byIdOrFail('r9').n()).toBe(1);
  });

  it('a rekey INSIDE the transaction also rolls back with replaceOne', async () => {
    const tree = await seed(topTree(), TOP);

    const p = tree.transaction(() => {
      tree.$.rows.replaceOne('r1', { id: 'r1', name: 'changed', n: 99 });
      tree.$.rows.changeId('r1', 'r9');
    });
    await flush();
    expect(tree.$.rows.ids()).toEqual(['r9']);

    p.rollback();
    await flush();

    expect(tree.$.rows.ids()).toEqual(['r1']);
    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
  });
});

describe('REPLACE-ONE-SUBJECT-1: controls', () => {
  it('upsertOne over the same subject still rolls back', async () => {
    const tree = await seed(topTree(), TOP);

    const p = tree.transaction(() =>
      tree.$.rows.upsertOne({ id: 'r1', name: 'changed', n: 99 })
    );
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('orig');
  });

  it('ordinary updateOne still rolls back', async () => {
    const tree = await seed(topTree(), TOP);

    const p = tree.transaction(() => tree.$.rows.updateOne('r1', { n: 99 }));
    await flush();
    p.rollback();
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').n()).toBe(1);
  });

  it('replaceOne still REMOVES keys the replacement omits', async () => {
    // The one thing replaceOne exists for, per its contract comment: assigning
    // the whole entity rather than spreading it. Preserved by the fix.
    const tree = await seed(topTree(), TOP);

    tree.$.rows.replaceOne('r1', { id: 'r1', name: 'only-name' } as Row);
    await flush();

    expect(tree.$.rows.byIdOrFail('r1').name()).toBe('only-name');
    // The omitted key's LEAF is gone entirely, not merely set to undefined —
    // which is the distinction `replaceOne` exists to express and `updateOne`
    // cannot. Unchanged by this fix.
    expect(
      (tree.$.rows.byIdOrFail('r1') as { n?: unknown }).n
    ).toBeUndefined();
  });
});
