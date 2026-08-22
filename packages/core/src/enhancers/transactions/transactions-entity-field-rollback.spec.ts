/**
 * ENTITY FIELD ROLLBACK — fixed, and pinned so it cannot silently return.
 *
 * `transaction(() => rows.updateOne(id, patch)).rollback()` used to restore
 * structural membership correctly and then write the FIELD's previous value into
 * the ENTITY slot:
 *
 *     before      ids ['A']   all [{ id: 'A', name: 'Alpha'   }]
 *     during tx   ids ['A']   all [{ id: 'A', name: 'Changed' }]
 *     after       ids ['A']   all ['Alpha']              <-- the row, replaced
 *
 * ## Root cause, one condition
 *
 * The capture is correct and always carried the full address:
 *
 *     { owner: 2, before: 'Alpha', after: 'Changed',
 *       subjectId: 1, path: 'rows.A.name', ownerPath: 'rows' }
 *
 * `hasInlineScopedLeafAddress` in `pending-rollback.ts` required
 * `effect.subjectId === undefined`, so it rejected that effect and sent it to the
 * branch that drops `path`/`ownerPath`. The applier was then left with a subject
 * id and no field path, resolved the target as the ROW, and wrote 'Alpha' into
 * it.
 *
 * A subject id and a scoped leaf address are NOT alternatives — an entity field
 * write has both, and `hasInlineSubjectAddress` on the applier side requires
 * both together. `reversal-planner.ts`, the undo path, has always carried them
 * unconditionally, which is precisely why `undo()` was correct while
 * `rollback()` was not.
 *
 * ## Why it was silent
 *
 * `ids()` was right and `all()` had the right LENGTH, so a list kept rendering
 * the correct number of items; only a consumer reading a field off a row saw
 * `undefined`, which renders as nothing. The existing transactions coverage
 * missed it because its entity rollback rows assert on `ids()` and whole-tree
 * snapshots after add/remove/changeId — never on the value of a row whose FIELD
 * was updated inside the transaction. That gap is closed by the rows below.
 *
 * Not a regression from any 15.0 work: reproduced unchanged at `0a23a551`, the
 * branch point, and older than that.
 */
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

type Row = { id: string; name: string; tag?: string };

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  ) as never as {
    (): { rows: { all: unknown[] } };
    $: {
      rows: {
        addOne(row: Row): void;
        updateOne(id: string, patch: Partial<Row>): void;
        all(): unknown[];
        ids(): string[];
        byId(id: string): (() => Row | undefined) | undefined;
      };
    };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

describe('transactions — entity field rollback', () => {
  it('restores the ROW, not the field value, after rollback', async () => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const pending = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Changed' });
    });
    expect(tree.$.rows.all()).toEqual([{ id: 'A', name: 'Changed' }]);

    pending.rollback();
    await settle();

    expect(tree.$.rows.ids()).toEqual(['A']);
    expect(tree.$.rows.all()).toEqual([{ id: 'A', name: 'Alpha' }]);
    expect(tree.$.rows.byId('A')?.()).toEqual({ id: 'A', name: 'Alpha' });
    // The whole-tree snapshot too: the defect reached the physical value
    // backing, so a projection-only assertion would not have caught it.
    expect(tree().rows.all).toEqual([{ id: 'A', name: 'Alpha' }]);
  });

  it('restores EVERY field written in the transaction, not just the first', async () => {
    // The same condition also broke this, one layer down. Rollback dedupes by
    // effect key, and while subject-addressed effects were denied their inline
    // address the key collapsed to the bare owner — so two writes to different
    // fields of one row produced ONE rollback effect and the second field kept
    // its transactional value.
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'A', name: 'Alpha', tag: 'first' });
    await settle();

    const pending = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Changed' });
      tree.$.rows.updateOne('A', { tag: 'second' });
    });
    expect(tree.$.rows.byId('A')?.()).toEqual({
      id: 'A',
      name: 'Changed',
      tag: 'second',
    });

    pending.rollback();
    await settle();

    expect(tree.$.rows.byId('A')?.()).toEqual({
      id: 'A',
      name: 'Alpha',
      tag: 'first',
    });
  });

  it('rolls back fields on two different rows independently', async () => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    tree.$.rows.addOne({ id: 'B', name: 'Beta' });
    await settle();

    const pending = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'A-changed' });
      tree.$.rows.updateOne('B', { name: 'B-changed' });
    });

    pending.rollback();
    await settle();

    expect(tree.$.rows.all()).toEqual([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
  });

  it('CONTROL: confirm() keeps the transactional value', async () => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const pending = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Changed' });
    });
    pending.confirm();
    await settle();

    expect(tree.$.rows.all()).toEqual([{ id: 'A', name: 'Changed' }]);
    expect(tree.$.rows.byId('A')?.()).toEqual({ id: 'A', name: 'Changed' });
  });

  it('CONTROL: a SCALAR leaf rollback was always correct and still is', async () => {
    // Narrows the fix to the entity path: this arm never regressed and must not
    // move now.
    const tree = signalTree(
      { count: 0 },
      { enhancers: [transactions()] }
    ) as never as {
      $: { count: { set(v: number): void; (): number } };
      transaction: (fn: () => void) => { rollback(): void };
    };
    tree.$.count.set(1);
    await settle();

    const pending = tree.transaction(() => tree.$.count.set(99));
    expect(tree.$.count()).toBe(99);

    pending.rollback();
    await settle();
    expect(tree.$.count()).toBe(1);
  });
});
