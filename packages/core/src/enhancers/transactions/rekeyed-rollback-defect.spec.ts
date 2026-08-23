import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * ⚠️ PINS A DEFECT. Everything asserted below is WRONG BEHAVIOUR, recorded so
 * it is visible and so fixing it is a deliberate change to this file rather
 * than a surprise. Same treatment `clear-not-undoable.spec.ts` had until the
 * repair landed.
 *
 * ## The defect
 *
 * Rolling back a pending transaction correctly reverses a `changeId` on its
 * own, a `removeOne` on its own, and a `changeId` followed by an `updateOne`.
 * It does NOT reverse a `changeId` followed by a `removeOne` of the same
 * subject in the same turn.
 *
 *   changeId('a','a2')                         -> rollback restores 'a'    OK
 *   removeOne('a')                             -> rollback restores 'a'    OK
 *   changeId('a','a2') + updateOne('a2',{...}) -> rollback restores 'a'
 *                                                 with 'Alpha'             OK
 *   changeId('a','a2') + removeOne('a2')       -> ids() === ['a2']         WRONG
 *
 * So it is specifically a rekey composed with a REMOVE. The removal is
 * reversed — the row comes back with its correct value — but the rekey is
 * not, so the row returns under the name it was renamed to.
 *
 * ## Provenance
 *
 * Found by the Step 8 Phase 6B ownership null while probing what a pending
 * transaction needs from a retired subject's backing. NOT caused by that probe
 * and NOT caused by any Step 8 change — the control without the experimental
 * deletion fails identically.
 *
 * Traced across the transactions repair rather than assumed, because the
 * rekey+update case DID change in that window and the two had to be told apart:
 *
 *   5c74381a  rekey+remove broken   rekey+update broken
 *   91043109  rekey+remove broken   rekey+update broken
 *   d487a4ae  rekey+remove broken   rekey+update FIXED   <- the repair
 *   HEAD      rekey+remove broken   rekey+update fixed
 *
 * `d487a4ae` ("entity field rollback restored the field value onto the row")
 * fixed the value case and left the structural one. This is the part of the
 * same family that repair did not reach.
 *
 * ## Why it is not fixed here
 *
 * It is a `transactions()` rollback-composition defect with no connection to
 * retention, and Step 8 is a memory-correctness change. Repairing structural
 * reversal inside it would mix two failure domains in one bisect. The Phase 6B
 * conclusion does not depend on it either: the states that matter for value
 * backing were measured on the paths that DO roll back correctly.
 *
 * ## What a fix has to do
 *
 * Reverse the rekey as well as the removal. Today the restore puts the subject
 * back under the key the removal saw, which is the post-rekey key, and nothing
 * walks back to the key the turn started from. When it is fixed, replace this
 * file — do not loosen it.
 */

type Row = { id: string; name: string };

const tick = () => Promise.resolve();

type Store = {
  $: {
    rows: {
      addOne(row: Row): void;
      removeOne(id: string): void;
      changeId(from: string, to: string): void;
      updateOne(id: string, patch: Partial<Row>): void;
      ids(): string[];
      byId(id: string): (() => Row | undefined) | undefined;
    };
  };
  transaction: (fn: () => void) => { confirm(): void; rollback(): void };
};

const makeStore = (): Store =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [transactions()] }
  ) as unknown as Store;

describe('transaction rollback after a rekey', () => {
  it('CONTROL: a rekey alone rolls back', async () => {
    const store = makeStore();
    store.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();

    const pending = store.transaction(() => {
      store.$.rows.changeId('a', 'a2');
    });
    expect(store.$.rows.ids()).toEqual(['a2']);

    pending.rollback();
    expect(store.$.rows.ids()).toEqual(['a']);
    expect(store.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });

  it('CONTROL: a removal alone rolls back', async () => {
    const store = makeStore();
    store.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();

    const pending = store.transaction(() => {
      store.$.rows.removeOne('a');
    });
    pending.rollback();

    expect(store.$.rows.ids()).toEqual(['a']);
    expect(store.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });

  it('DEFECT: rekey then remove leaves the row under the NEW key', async () => {
    const store = makeStore();
    store.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();

    const pending = store.transaction(() => {
      store.$.rows.changeId('a', 'a2');
      store.$.rows.removeOne('a2');
    });
    expect(store.$.rows.ids()).toEqual([]);

    pending.rollback();

    // CORRECT WOULD BE `['a']`. The removal is reversed; the rekey is not.
    expect(store.$.rows.ids()).toEqual(['a2']);
    expect(store.$.rows.byId('a')).toBeUndefined();
  });

  it('CONTROL: rekey then update rolls back — fixed by d487a4ae', async () => {
    const store = makeStore();
    store.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();

    const pending = store.transaction(() => {
      store.$.rows.changeId('a', 'a2');
      store.$.rows.updateOne('a2', { name: 'Changed' });
    });
    pending.rollback();

    // Correct, and it is the reason the defect below is specifically about a
    // following REMOVE rather than about rekeys in general.
    expect(store.$.rows.ids()).toEqual(['a']);
    expect(store.$.rows.byId('a')?.()?.name).toBe('Alpha');
  });
});
