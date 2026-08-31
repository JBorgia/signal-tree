import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import {
  getTransactionLifecycleChannel,
  tryGetTransactionLifecycleChannel,
} from '../../lib/internals/causal-runtime/transaction-lifecycle';
import { batching } from '../batching/batching';
import { restoration } from '../restoration/restoration';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';

/**
 * TURN-FEED-0.2 — channel ownership, identity and reachability.
 *
 * > A transaction lifecycle channel has exactly one owner per transaction
 * > runtime. Observers may RESOLVE that channel from the public tree, but may
 * > never CREATE one. Reachability must not depend on which other enhancers are
 * > installed.
 *
 * The defect this repairs, found while probing DIAG-JOURNAL-1's grouping:
 *
 * ```text
 * enhancers: [transactions()]                 subscriber received NOTHING
 * enhancers: [restoration(), transactions()]  subscriber received everything
 * ```
 *
 * `getTransactionLifecycleChannel()` was doing two jobs — "create if missing"
 * for the owner and "find" for an observer. An observer asking the wrong owner
 * silently got a brand-new channel that could never fire. Fail-open by
 * construction: no error, no warning, just silence.
 *
 * The canonical owner is the tree/controller because lifecycle and transaction
 * authority are tree-level semantics. `$` is a state location; its callable or
 * non-callable representation cannot decide lifecycle placement.
 *
 * Why TURN-FEED-0 missed it: every case that SUBSCRIBES composes
 * `restoration() + transactions()`. The one single-enhancer case asserts that
 * behaviour is unchanged and never subscribes — "announcing to nobody is not an
 * error" was true of what it tested, and quietly normalised the missing
 * condition. It proved *installing the protocol does not disturb transactions()*
 * and we read it as *transactions() exposes the protocol*.
 *
 * This file does NOT change the event vocabulary, what the channel carries, or
 * any transaction semantics. It repairs ownership, identity, reachability and
 * failure behaviour.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const LIFECYCLE = Symbol.for('SignalTree:TransactionLifecycleChannel');

const watch = (tree: object) => {
  const seen: string[] = [];
  const off = getTransactionLifecycleChannel(tree).subscribe((e) =>
    seen.push(e.kind)
  );
  return { seen, off };
};

describe('TURN-FEED-0.2: reachable from the tree the application holds', () => {
  it('case 1 — transactions() ALONE, confirmed', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    await flush();
    const w = watch(tree);

    tree.transaction(() => tree.$.n.set(1)).confirm();
    await flush();
    w.off();

    expect(w.seen).toEqual(['opened', 'staged', 'confirmed']);
  });

  it('case 2 — transactions() ALONE, rolled back', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();
    const w = watch(tree);

    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' })
    );
    await flush();
    pending.rollback();
    await flush();
    w.off();

    expect(w.seen).toEqual(['opened', 'staged', 'rolled-back']);
  });

  it('case 3 — composed with restoration(), identical semantics', async () => {
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    const w = watch(tree);

    tree.transaction(() => tree.$.n.set(1)).confirm();
    await flush();
    w.off();

    expect(w.seen).toEqual(['opened', 'staged', 'confirmed']);
  });

  it('case 4 — enhancer ORDER does not change what an observer hears', async () => {
    const run = async (order: 'tx-first' | 'restoration-first') => {
      const tree = signalTree(
        { n: 0 },
        {
          enhancers:
            order === 'tx-first'
              ? [transactions(), restoration()]
              : [restoration(), transactions()],
        }
      );
      await flush();
      const w = watch(tree);
      tree.transaction(() => tree.$.n.set(1)).confirm();
      await flush();
      w.off();
      return w.seen;
    };

    // Order-independence is the ownership premise: whichever authority sets up
    // first installs the one channel and the other joins it.
    expect(await run('tx-first')).toEqual(await run('restoration-first'));
  });

  it('case 5 — two trees have distinct channels and do not cross-talk', async () => {
    const a = signalTree({ n: 0 }, { enhancers: [transactions()] });
    const b = signalTree({ n: 0 }, { enhancers: [transactions()] });
    await flush();
    const wa = watch(a);
    const wb = watch(b);

    a.transaction(() => a.$.n.set(1)).confirm();
    await flush();
    wa.off();
    wb.off();

    expect(wa.seen).toEqual(['opened', 'staged', 'confirmed']);
    expect(wb.seen).toEqual([]);
    expect(getTransactionLifecycleChannel(a)).not.toBe(
      getTransactionLifecycleChannel(b)
    );
  });

  it('case 6 — an observer resolving BEFORE the first transaction is heard', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    // Deliberately no flush: resolve at the earliest moment a caller could.
    const w = watch(tree);
    await flush();

    tree.transaction(() => tree.$.n.set(1)).confirm();
    await flush();
    w.off();

    expect(w.seen).toEqual(['opened', 'staged', 'confirmed']);
  });

  it('case 7 — a tree with NO transaction owner reports clean absence', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [batching()] });
    await flush();

    // Absence is legitimate and must not be an error: a diagnostic observer has
    // to work on a tree that simply has no transaction capability.
    expect(tryGetTransactionLifecycleChannel(tree)).toBeUndefined();
  });

  it('case 7b — restoration() ALONE does expose a channel, and that is correct', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();

    // Measured while writing case 7, which first asserted the opposite and
    // failed. Restoration owns transactions of its own — it holds a
    // `transactionOwnerToken` and drives the manager directly — so it is a
    // transaction owner and installs the channel. Absence is keyed on having no
    // OWNER, not on the `transactions()` enhancer specifically.
    expect(tryGetTransactionLifecycleChannel(tree)).toBeDefined();
  });

  it('case 8 — SELF-TEST: authority present, channel missing, is LOUD', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    await flush();

    // Break exactly the thing the repair installs — the channel on the canonical
    // host — while leaving the transaction authority in place. This is the state
    // the old code produced silently on every single-enhancer tree.
    const host = tree as unknown as object;
    expect(
      Object.prototype.hasOwnProperty.call(host, LIFECYCLE)
    ).toBe(true);
    delete (host as Record<symbol, unknown>)[LIFECYCLE];

    // Never a freshly minted inert channel.
    expect(tryGetTransactionLifecycleChannel(tree)).toBeUndefined();
    expect(() => getTransactionLifecycleChannel(tree)).toThrowError(/ST1036/);
    expect(() => getTransactionLifecycleChannel(tree)).toThrowError(
      /transaction authority but no lifecycle channel/
    );
  });

  it('case 8b — SELF-TEST: the OTHER owner, restoration(), is equally loud', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();

    const host = tree as unknown as object;
    expect(Object.prototype.hasOwnProperty.call(host, LIFECYCLE)).toBe(true);
    delete (host as Record<symbol, unknown>)[LIFECYCLE];

    // Case 8 proved fail-loud for ONE owner implementation. The invariant is
    // about a transaction OWNER, and restoration is one — so the same corruption
    // must produce the same corruption message here.
    expect(tryGetTransactionLifecycleChannel(tree)).toBeUndefined();
    expect(() => getTransactionLifecycleChannel(tree)).toThrowError(
      /transaction authority but no lifecycle channel/
    );
  });

  it('case 8c — no owner and no channel is legitimate absence, not corruption', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [batching()] });
    await flush();

    expect(tryGetTransactionLifecycleChannel(tree)).toBeUndefined();
    expect(() => getTransactionLifecycleChannel(tree)).toThrowError(
      /no transaction capability/
    );
  });

  it('case 9 — repeated lookups return the SAME channel identity', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [transactions()] });
    await flush();

    const first = getTransactionLifecycleChannel(tree);
    const second = getTransactionLifecycleChannel(tree);
    const viaTry = tryGetTransactionLifecycleChannel(tree);

    expect(second).toBe(first);
    expect(viaTry).toBe(first);
  });

  it('case 10 — unsubscribing leaves transaction behaviour untouched', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    await flush();
    const w = watch(tree);
    w.off();

    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'a', name: 'Alpha' })
    );
    await flush();
    expect(tree.$.rows.ids()).toEqual(['a']);
    pending.rollback();
    await flush();

    expect(tree.$.rows.ids()).toEqual([]);
    expect(w.seen).toEqual([]);
  });
});
