/**
 * DOCUMENTED DEFECT — rolling back an entity FIELD update corrupts the row.
 *
 * `transaction(() => rows.updateOne(id, patch)).rollback()` restores structural
 * membership correctly and then writes the FIELD's previous value into the
 * ENTITY slot. The row stops being an object:
 *
 *     before      ids ['A']   all [{ id: 'A', name: 'Alpha'   }]   byId {...}
 *     during tx   ids ['A']   all [{ id: 'A', name: 'Changed' }]   byId {...}
 *     after       ids ['A']   all ['Alpha']                        byId 'Alpha'
 *
 * `confirm()` on the same transaction is correct, so this is specific to the
 * rollback path.
 *
 * ## Why this is pinned rather than fixed here
 *
 * NOT A REGRESSION. Reproduced unchanged at `0a23a551`, the commit the 15.0
 * declarative-construction work branched from, and therefore older than that.
 * Found while writing the zero-owner lifetime-ledger trial
 * (`entity-lifetime-ledger-null.spec.ts`), whose GATE 5b needed a
 * transactions-are-unaffected control and could not get a passing one.
 *
 * It is pinned so it cannot change silently in either direction: a fix makes
 * these rows fail loudly and they should then be rewritten to the correct
 * expectation, and a further drift also fails.
 *
 * ## Why it is SILENT today
 *
 * `ids()` is right and `all()` has the right LENGTH, so a list keeps rendering
 * the correct number of items. Only a consumer reading a field off a row sees
 * `undefined`, and `undefined` in a template renders as nothing. The existing
 * transactions coverage did not catch it because the entity rollback rows there
 * assert on `ids()` and on whole-tree snapshots after add/remove/changeId — not
 * on the value of a row whose FIELD was updated inside the transaction.
 *
 * ## Severity
 *
 * Data corruption on a supported public path, silent, with no diagnostic. It
 * belongs on the release-hardening queue before the RC, not after.
 */
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

type Row = { id: string; name: string };

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
        byId(id: string): (() => unknown) | undefined;
      };
    };
    transaction: (fn: () => void) => { rollback(): void; confirm(): void };
  };

describe('transactions — documented defects', () => {
  it('DEFECT: rollback of updateOne replaces the row with the field value', async () => {
    const tree = makeTree();
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    await settle();

    const pending = tree.transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Changed' });
    });
    // Inside the transaction everything is still correct.
    expect(tree.$.rows.all()).toEqual([{ id: 'A', name: 'Changed' }]);

    pending.rollback();
    await settle();

    // Membership: CORRECT.
    expect(tree.$.rows.ids()).toEqual(['A']);

    // Value: WRONG. Should be [{ id: 'A', name: 'Alpha' }].
    expect(tree.$.rows.all()).toEqual(['Alpha']);
    expect(tree.$.rows.byId('A')?.()).toBe('Alpha');
    // And it reaches the whole-tree snapshot, so it is not a projection-only
    // artifact — the physical value backing itself holds the wrong thing.
    expect(tree().rows.all).toEqual(['Alpha']);
  });

  it('CONTROL: confirm() on the same transaction is correct', async () => {
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

  it('CONTROL: rollback of a SCALAR leaf write is correct', async () => {
    // Narrows the defect to the entity path rather than rollback in general.
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
