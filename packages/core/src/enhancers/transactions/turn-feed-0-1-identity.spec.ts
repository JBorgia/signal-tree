import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../time-travel/time-travel';
import { transactions } from './transactions';

/**
 * TURN-FEED-0.1 — does pair identity hold ALL THE WAY DOWN?
 *
 * The protocol justifies carrying `(owner, id)` on the premise that per-enhancer
 * allocators can mint the same numeric id. But time-travel's capture buckets are
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
            timeTravel({ maxHistorySize: 50 }),
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
      { enhancers: [timeTravel({ maxHistorySize: 10 }), transactions()] }
    );
    const treeB = signalTree(
      { n: 0 },
      { enhancers: [timeTravel({ maxHistorySize: 10 }), transactions()] }
    );
    await flush();

    // Two TREES each with their own owner and their own id-1 transaction. The
    // buckets live per-tree in per-enhancer closures, so this is the case that
    // would break a truly global numeric key — and it does not, because nothing
    // is global.
    const a = treeA.transaction(() => treeA.$.n.set(1));
    const b = treeB.transaction(() => treeB.$.n.set(2));
    await flush();
    a.confirm();
    b.confirm();
    await flush();

    expect(treeA.$.n()).toBe(1);
    expect(treeB.$.n()).toBe(2);
    expect(treeA.getHistory().length).toBeGreaterThan(1);
    expect(treeB.getHistory().length).toBeGreaterThan(1);
  });
});
