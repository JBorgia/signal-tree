import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { restoration } from '../enhancers/restoration/restoration';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * A2-3 — SETTLEMENT. Which placement can obey PER-B's rule using only the ONE
 * existing consequence authority?
 *
 * The rule is not reopened. PER-B P5/P7 settled it:
 *
 * ```text
 * pending    do not persist
 * confirm    persistence may run
 * rollback   the speculative value must not reach storage
 * ```
 *
 * The question is which public shape can obey it **without learning transaction
 * internals or inventing a second settlement authority.** MATRIX-CLOSE M9 already
 * established the division:
 *
 * ```text
 * transactions        decides WHEN settlement happened
 * commit-consequence  decides WHETHER this effect may run now
 * ```
 *
 * So a persister is allowed to route through `scheduleDurableConsequence` and
 * nothing else. If it needs to inspect a transaction, that placement loses.
 *
 * ⚠️ THE DISCRIMINATOR is what the authority needs in order to answer.
 * `resolveScopeKey(claimant)` resolves a per-tree scope via
 * `getPositionRegistry(candidate.$ ?? node)`. Whether that resolves from a LEAF
 * NODE decides whether per-node composition (A2-B) is viable, or whether it needs
 * the tree anyway and collapses into a tree-scoped capability (A2-C).
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/**
 * The smallest honest persister. It observes writes through the public notifier
 * and defers every durable write through the single consequence authority — no
 * transaction inspection anywhere.
 */
const makePersister = (claimant: unknown, path: string, store: Map<string, unknown>) => {
  const durableWrites: unknown[] = [];
  const off = getPathNotifier().subscribe('**', (next, _p, writtenPath) => {
    if (writtenPath !== path) return;
    scheduleDurableConsequence({
      claimant,
      key: path,
      run: () => {
        store.set(path, next);
        durableWrites.push(next);
      },
    });
  });
  return { durableWrites, off };
};

describe('A2-3 arm B: persister given ONLY the leaf node', () => {
  /**
   * ⚠️ THIS RESULT WAS INVERTED BY THE OWNERSHIP CORRECTION, and the inversion
   * is the point rather than a regression.
   *
   * A2-3 measured arm B FAILING — the speculative value leaked to storage
   * during the pending transaction — and read that as "a leaf cannot resolve a
   * commit scope, therefore a persistence API must be handed the tree". The
   * cause was narrower: `definePositionRegistry` was called on `tree` and
   * `tree.$` only, so `resolveScopeKey(leaf)` had nothing to resolve. A leaf
   * now carries the same registry object the tree does, and the SAME code in
   * `commit-consequence` — unchanged — now answers correctly.
   *
   * So the conclusion A2-3 drew is withdrawn: a leaf claimant defers properly,
   * and an explicit `tree` argument is not earned by settlement.
   */
  it('a leaf claimant NOW resolves its own scope and defers correctly', async () => {
    const store = new Map<string, unknown>([['theme', 'light']]);
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    // claimant = the LEAF NODE, which is all a `persist(tree.$.theme)` signature
    // would give the implementation.
    const p = makePersister(tree.$.theme, 'theme', store);

    const pending = tree.transaction(() => {
      tree.$.theme('dark');
    });
    await flush();
    const duringPending = store.get('theme');

    pending.rollback();
    await flush();
    p.off();

    // MEASURED BEFORE THE OWNERSHIP CORRECTION: `duringPending` was 'dark' —
    // the speculative value leaked to storage and was only repaired by a later
    // overwrite. `resolveScopeKey` asks `getPositionRegistry(candidate.$ ?? node)`,
    // and a leaf answered nothing, so `hasOpen()` was false and the write ran
    // immediately. The authority was never wrong; it was asked a question a leaf
    // could not answer.
    //
    // MEASURED NOW: the leaf resolves the tree's registry, so the same authority
    // defers the write exactly as the tree-claimant arm does.
    expect(duringPending).toBe('light');
    expect(store.get('theme')).toBe('light');
    expect(tree.$.theme()).toBe('light');
  });
});

describe('A2-3 arm C: persister given the TREE as claimant', () => {
  it('pending must not persist, and rollback must not leak', async () => {
    const store = new Map<string, unknown>([['theme', 'light']]);
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const p = makePersister(tree, 'theme', store);

    const pending = tree.transaction(() => {
      tree.$.theme('dark');
    });
    await flush();
    const duringPending = store.get('theme');

    pending.rollback();
    await flush();
    p.off();

    // ARM C DEFERS CORRECTLY: nothing durable during the pending transaction.
    expect(duringPending).toBe('light');
    expect(store.get('theme')).toBe('light');
    expect(tree.$.theme()).toBe('light');

    // ⚠️ SECOND FINDING, and it is a constraint on any compositional design.
    // Two durable writes eventually ran, IN THIS ORDER:
    expect(p.durableWrites).toEqual(['dark', 'light']);
    // So storage transiently held the ROLLED-BACK value after settlement. The
    // final state is correct, but a crash in that window leaves durable truth
    // holding speculative data.
    //
    // DEFERRAL ALONE IS INSUFFICIENT. `stored()` does not have this hazard
    // because it CANCELS pending writes on the discard outcome rather than
    // merely re-ordering them (see `cancelPending` in stored.ts). Any
    // compositional persister must do the same, which means it needs the
    // settlement OUTCOME and not just permission to run.
  });

  it('and CONFIRM must let the durable write through', async () => {
    const store = new Map<string, unknown>([['theme', 'light']]);
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const p = makePersister(tree, 'theme', store);

    const pending = tree.transaction(() => {
      tree.$.theme('dark');
    });
    await flush();
    const duringPending = store.get('theme');

    pending.confirm();
    await flush();
    p.off();

    expect(duringPending).toBe('light');
    expect(store.get('theme')).toBe('dark');
  });

  it('CONTROL — an ordinary authored write persists immediately', async () => {
    const store = new Map<string, unknown>([['theme', 'light']]);
    const tree = signalTree(
      { theme: 'light' },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    const p = makePersister(tree, 'theme', store);
    tree.$.theme('dark');
    await flush();
    p.off();

    // Without this arm, "pending did not persist" could be satisfied by a
    // persister that never persists anything.
    expect(store.get('theme')).toBe('dark');
  });
});
