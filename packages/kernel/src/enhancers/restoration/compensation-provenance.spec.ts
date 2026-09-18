import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { undoable } from '../../lib/undoable';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './../transactions/transactions';
import { restoration } from './restoration';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

const tree = () =>
  signalTree(
    { theme: 'light' },
    { enhancers: [restoration(), transactions()] }
  );

const realize = (apply: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, apply);

/**
 * A transaction's compensation is `realized`, but it is NOT external truth.
 *
 * ## The defect
 *
 * Restoration's P0-C provenance index recorded every `realized` write as
 * external truth, including a rollback's restore half. So an abandoned
 * speculative turn poisoned the undo of an EARLIER, unrelated authored turn:
 *
 * ```text
 * light -> authored 'dark' -> speculative 'speculative' -> rollback 'dark'
 *   undo  =>  ST1034 refused: "'theme' changed after the operation being reversed"
 * ```
 *
 * The rollback restored exactly the value the authored turn produced, so there
 * was no divergence to protect against — but the index had already labelled
 * that value foreign, and P0-C correctly refuses to overwrite truth history does
 * not own.
 *
 * The fact needed to tell the two apart already existed. `transactions.ts`
 * stamps `origin: 'transaction-rollback'` and says why in its own comment:
 * "without them a compensation turn was indistinguishable from external truth".
 * Nothing consumed it. The fix teaches the recorder to read it — see
 * `isCompensationWrite` — rather than weakening the refusal policy.
 *
 * ## Why the controls matter more than the fix
 *
 * The cheap wrong fix is to relax P0-C. These pin that genuine external truth is
 * still protected, before and after a rollback.
 */
describe('compensation is not external truth', () => {
  it('undo succeeds after an abandoned speculative turn', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    const pending = store.transaction(() => store.$.theme('speculative'));
    await flush();
    pending.rollback();
    await flush();
    expect(store.$.theme()).toBe('dark');

    store.undo();
    await flush();
    expect(store.$.theme()).toBe('light');
    store.destroy();
  });

  it('CONTROL: genuine external truth still refuses the undo', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    expect(() => store.undo()).toThrowError(/ST1034/);
    expect(store.$.theme()).toBe('blue');
    store.destroy();
  });

  it('CONTROL: external truth arriving AFTER a rollback is still protected', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    const pending = store.transaction(() => store.$.theme('speculative'));
    await flush();
    pending.rollback();
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    // The rollback cleared provenance; the later realization re-acquires it.
    expect(() => store.undo()).toThrowError(/ST1034/);
    expect(store.$.theme()).toBe('blue');
    store.destroy();
  });

  it('rollback does not add an undo step of its own', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    const pending = store.transaction(() => store.$.theme('speculative'));
    await flush();
    pending.rollback();
    await flush();

    // One authored turn exists, so exactly one undo reaches the origin and the
    // history is then exhausted. If the rollback had been recorded as its own
    // authored turn, the first undo would land on 'speculative' instead.
    store.undo();
    await flush();
    expect(store.$.theme()).toBe('light');
    expect(store.canUndo()).toBe(false);
    store.destroy();
  });

  /**
   * A rollback restores prior truth AND prior authority over that truth.
   *
   * The speculative authored write supersedes external provenance while it is
   * in force — that is correct, an authored write does return a location to
   * history's control. But if the turn is then ABANDONED, the location must go
   * back to being externally owned. Otherwise an abandoned transaction silently
   * grants history authority it never had, and a later undo will overwrite a
   * value the server owns.
   *
   * Paired with the confirm case below, because the contrast is the law:
   *
   * ```text
   * rollback     restores prior authority
   * confirmation replaces prior authority
   * ```
   */
  it('rollback restores external authority that existed before the turn', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    const pending = store.transaction(() => store.$.theme('red'));
    await flush();
    pending.rollback();
    await flush();
    expect(store.$.theme()).toBe('blue');

    // `blue` came from outside. The abandoned turn must not have handed it to
    // history, so reversing the earlier authored turn must still refuse.
    expect(() => store.undo()).toThrowError(/ST1034/);
    expect(store.$.theme()).toBe('blue');
    store.destroy();
  });

  it('CONTROL: a CONFIRMED turn permanently supersedes external authority', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    const pending = store.transaction(() => store.$.theme('red'));
    await flush();
    await pending.commit?.();
    await flush();
    expect(store.$.theme()).toBe('red');

    // The authored turn really did supersede the realization, so the old
    // external claim on `blue` must NOT come back to refuse anything.
    expect(() => store.undo()).not.toThrowError(/ST1034/);
    store.destroy();
  });

  /**
   * The case a path-keyed baseline cannot represent.
   *
   * Two transactions supersede the SAME path. Keyed by path, T2's compensation
   * consumes the entry T1 recorded and wrongly hands back the EXTERNAL value,
   * discarding T1's speculative write that is still in force. Keyed by
   * transaction, each compensation restores only what its own turn displaced.
   *
   * Getting here required making the compensation joinable at all: the write
   * context stamped a pending-TURN id where restoration joins on a TRANSACTION
   * id, and omitted `transactionOwner` entirely.
   */
  it('overlapping turns on one path each restore only their own displacement', async () => {
    const store = tree();
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    const first = store.transaction(() => store.$.theme('red'));
    await flush();
    const second = store.transaction(() => store.$.theme('green'));
    await flush();
    expect(store.$.theme()).toBe('green');

    // T2 displaced T1's 'red', not the external 'blue'. Rolling T2 back must
    // return 'red' and leave T1 in force.
    second.rollback();
    await flush();
    expect(store.$.theme()).toBe('red');

    store.destroy();
  });

  it('CURRENT BEHAVIOUR: an out-of-order rollback is refused', async () => {
    const store = tree();
    await flush();

    realize(() => store.$.theme('blue'));
    await flush();

    const first = store.transaction(() => store.$.theme('red'));
    await flush();
    const second = store.transaction(() => store.$.theme('green'));
    await flush();

    second.rollback();
    await flush();

    // Pinned as observed, not as desired: the outer turn can no longer be
    // reversed once an inner one has been. Recorded so a storage refactor
    // cannot change it silently.
    expect(() => first.rollback()).toThrowError(/could not rollback/i);
    store.destroy();
  });

  it('redo still returns the authored value after a rollback', async () => {
    const store = tree();
    await flush();

    undoable(() => store.$.theme('dark'));
    await flush();

    const pending = store.transaction(() => store.$.theme('speculative'));
    await flush();
    pending.rollback();
    await flush();

    store.undo();
    await flush();
    expect(store.$.theme()).toBe('light');

    store.redo();
    await flush();
    expect(store.$.theme()).toBe('dark');
    store.destroy();
  });
});
