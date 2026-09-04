import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { getTransactionLifecycleChannel } from '../../lib/internals/causal-runtime/transaction-lifecycle';
import { signalTree } from '../../lib/signal-tree';
import { restoration } from '../restoration/restoration';
import { transactions } from './transactions';

/**
 * TURN-FEED-0.1 — does pair identity hold ALL THE WAY DOWN?
 *
 * The protocol justifies carrying `(owner, id)` on the premise that per-enhancer
 * allocators can mint the same numeric id. But restoration's capture buckets are
 * `Map<number, CaptureBucket>` — keyed by the id alone. So the stated invariant
 * and the implementation disagree:
 *
 *   lifecycle identity       (owner, id)
 *   capture-bucket identity  id
 *
 * Either the pair matters and the buckets are wrong, or only one transaction
 * owner can exist per tree and the pair is defensive. This proves which.
 *
 * Two `transactions()` enhancers on one tree is the way to get two owners: each
 * closes over its own `transactionOwnerToken` and its own `nextTransactionId`,
 * so both mint id 1.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('TURN-FEED-0.1: two transaction owners on one tree', () => {
  it('THE ANSWER — two owners on one tree are REFUSED by construction', () => {
    // Not "unlikely" — refused. The enhancer-configuration guard rejects the
    // duplicate before the tree exists, so the collision the pair identity was
    // defending against cannot arise within a tree at all.
    expect(() =>
      signalTree(
        { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
        {
          enhancers: [
            restoration({ maxHistorySize: 50 }),
            transactions(),
            transactions(),
          ],
        }
      )
    ).toThrow(/configured 2 times|may appear once/);
  });

  it('THE STRUCTURAL FACT — one reachable transaction() means one live owner', async () => {
    // This is what makes the numeric bucket key safe today, and it is a
    // structural property rather than a lucky coincidence: `transaction` is a
    // single property on the tree, so whichever enhancer assigns it last is the
    // only owner that can ever open a transaction. Two owners can be INSTALLED;
    // only one can be USED.
    //
    // The consequence for TURN-FEED-0: the `(owner, id)` pair is DEFENSIVE
    // protocol identity, not a live collision risk. It costs nothing, it keeps
    // the channel honest if a second reachable owner ever appears, and it means
    // the bucket key is an internal detail rather than a load-bearing assumption.
    const treeA = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    const treeB = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    await flush();

    // Two TREES each with their own owner and their own id-1 transaction. The
    // buckets live per-tree in per-enhancer closures, so this is the case that
    // would break a truly global numeric key — and it does not, because nothing
    // is global.
    const a = undoable(() => treeA.transaction(() => treeA.$.n(1)));
    const b = undoable(() => treeB.transaction(() => treeB.$.n(2)));
    await flush();
    a.confirm();
    b.confirm();
    await flush();

    // Both trees committed their own id-1 transaction independently, and each
    // admitted its own turn. Designated because the point is that the two
    // buckets do not collide — which is only observable if both are recorded.
    expect(treeA.$.n()).toBe(1);
    expect(treeB.$.n()).toBe(2);
    expect(treeA.getRestorationHistory().length).toBe(1);
    expect(treeB.getRestorationHistory().length).toBe(1);
  });
});

describe('MATRIX-CLOSE S5: the invariant that makes a bare id sufficient', () => {
  it('two trees each mint id 1, and no observer sees both', async () => {
    const a = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    const b = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    await flush();

    const seenA: Array<{ id: number; owner: unknown }> = [];
    const seenB: Array<{ id: number; owner: unknown }> = [];
    const offA = getTransactionLifecycleChannel(a as object).subscribe((e) => {
      if (e.kind === 'opened') seenA.push({ id: e.id, owner: e.owner });
    });
    const offB = getTransactionLifecycleChannel(b as object).subscribe((e) => {
      if (e.kind === 'opened') seenB.push({ id: e.id, owner: e.owner });
    });

    a.transaction(() => a.$.n(1)).confirm();
    b.transaction(() => b.$.n(1)).confirm();
    await flush();
    offA();
    offB();

    // ⚠️ THIS IS WHY THE OWNER ORDINAL COULD LEAVE THE KEY. Both trees mint id
    // 1, and each observer sees exactly one of them — the channel is installed
    // per tree, so the collision the ordinal disambiguated cannot reach any
    // single reader.
    expect(seenA.map((e) => e.id)).toEqual([1]);
    expect(seenB.map((e) => e.id)).toEqual([1]);
    expect(seenA[0].owner).not.toBe(seenB[0].owner);

    // And within one channel there is exactly ONE announcing owner, which is the
    // other half: ids are unique in the only scope that reads them.
    expect(new Set(seenA.map((e) => e.owner)).size).toBe(1);
  });

  it('event.owner is still load-bearing — the foreign/own filter', async () => {
    // The half M6 did NOT disprove, and which had no proof of its own. Removing
    // the owner from the derived KEY is safe; removing it from the EVENT is not,
    // because restoration compares it directly to ignore its own announcements
    // and act only on foreign ones.
    const tree = signalTree(
      { n: 0 },
      { enhancers: [restoration({ maxHistorySize: 10 }), transactions()] }
    );
    await flush();

    const owners: unknown[] = [];
    const off = getTransactionLifecycleChannel(tree as object).subscribe((e) => {
      owners.push(e.owner);
    });
    tree.transaction(() => tree.$.n(1)).confirm();
    await flush();
    off();

    // Every announcement carries an owner, and it is the SAME one — which is
    // exactly what makes `event.owner === transactionOwnerToken` a usable
    // filter rather than a coin flip.
    expect(owners.length).toBeGreaterThan(0);
    expect(owners.every((o) => o !== undefined && o !== null)).toBe(true);
    expect(new Set(owners).size).toBe(1);
  });
});
