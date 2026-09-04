import { describe, expect, it } from 'vitest';

import { entityMap } from './types';
import {
  getOwnedOwnerPath,
  getOwnedPositionIds,
} from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * ENTITY-LINK-0 — is `entityMap` an independently addressable state location?
 *
 * ```text
 * NULL       entityMap is INTENTIONALLY not a linkable state location, and
 *            excluding it costs no meaningful link selectivity
 * FALSIFIER  a collection can be independently meaningful external state while
 *            its parent branch holds unrelated state, making parent-branch
 *            linking semantically DIFFERENT rather than merely syntactically
 *            different
 * ```
 *
 * ⚠️ DEMARCATION-0 said the exclusion "costs a spelling rather than a
 * capability". That was not proven, and this file checks it.
 *
 * The rule this must respect: do NOT add ownership metadata just so `link()`
 * can accept a collection. Either entityMap is already meant to be an
 * addressable location — in which case the hole is broader than link and link
 * merely found it — or it is deliberately excluded and the exclusion gets
 * documented.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

/** A collection beside genuinely unrelated siblings — the realistic shape. */
const appTree = () =>
  signalTree(
    {
      data: {
        rows: entityMap<Row, string>({ selectId: (r) => r.id }),
        selectedId: null as string | null,
        page: 1,
      },
    },
    { enhancers: [restoration(), transactions()] }
  );

describe('ENTITY-LINK-0: what identity does a collection already carry?', () => {
  it('⚠️ it IS an addressable position — only the registry back-reference is missing', async () => {
    const tree = appTree();
    await flush();
    const registry = getPositionRegistry(tree.$);

    const rows = tree.$.data.rows;
    const page = tree.$.data.page;

    // A plain leaf beside it, for comparison.
    expect(getOwnedPositionIds(page)).toBeDefined();
    expect(getOwnedOwnerPath(page)).toBe('data.page');
    expect(getPositionRegistry(page)).toBe(registry);

    // The collection carries the SAME facts as the leaf beside it — a position
    // id allocated from this tree's registry, and its own owner path.
    expect(getOwnedPositionIds(rows)).toBeDefined();
    expect(getOwnedOwnerPath(rows)).toBe('data.rows');

    // ⚠️ THIS WAS ABSENT, AND IS THE FINDING THIS FILE EXISTS FOR. Measured
    // when written: `undefined`. OWNER-LOCATION-0 then showed `stored()` had
    // the identical shape — so the gap was never entityMap-specific — and fixed
    // both at the marker construction boundary.
    expect(getPositionRegistry(rows)).toBe(registry);
  });

  it('and the topology treats it as its own position — restoration reverses it alone', async () => {
    const tree = appTree();
    await flush();

    undoable(() => {
      tree.$.data.rows.addOne({ id: 'a', n: 1 });
    });
    await flush();
    undoable(() => {
      tree.$.data.page(2);
    });
    await flush();

    // Two separate turns over two separate positions. Undoing the page change
    // must not disturb the collection.
    tree.undo();
    await flush();

    expect(tree.$.data.page()).toBe(1);
    expect(tree.$.data.rows.all()).toHaveLength(1);

    // And undoing again reverses the collection turn on its own.
    tree.undo();
    await flush();
    expect(tree.$.data.rows.all()).toHaveLength(0);
  });
});

describe('ENTITY-LINK-0: is parent-branch linking the SAME thing?', () => {
  it('⚠️ NO — an unrelated sibling drives the endpoint', async () => {
    const tree = appTree();
    await flush();

    // What a link on the PARENT BRANCH would observe: every settled turn under
    // `data`, whatever position it touched.
    const branchTriggers: string[] = [];
    const rowsTriggers: string[] = [];
    const ownerPathOf = (p: string) => p.startsWith('data');
    const off = (
      await import('./path-notifier')
    ).getPathNotifier().subscribe('**', (v, prev, path) => {
      if (v === undefined && prev === undefined) return;
      if (!ownerPathOf(path)) return;
      branchTriggers.push(path);
      if (path === 'data.rows' || path.startsWith('data.rows.')) {
        rowsTriggers.push(path);
      }
    });

    // A purely presentational change, unrelated to the collection.
    tree.$.data.page(2);
    await flush();
    tree.$.data.selectedId('a');
    await flush();
    off();

    // ⚠️ THE FALSIFIER. A parent-branch link fires for BOTH of these and would
    // send the whole `data` object to a rows endpoint. A collection-scoped link
    // would fire for neither.
    expect(branchTriggers).toEqual(['data.page', 'data.selectedId']);
    expect(rowsTriggers).toEqual([]);
  });

  it('⚠️ and the VALUE SHAPE differs — a rows endpoint would receive siblings', async () => {
    const tree = appTree();
    await flush();
    tree.$.data.rows.addOne({ id: 'a', n: 1 });
    tree.$.data.page(3);
    await flush();

    const branchValue = tree.$.data() as Record<string, unknown>;

    // What a parent-branch link would hand to `endpoint.set`.
    expect(Object.keys(branchValue).sort()).toEqual([
      'page',
      'rows',
      'selectedId',
    ]);

    // What a rows endpoint actually wants. The two are not the same payload, so
    // "link the parent instead" changes the CONTRACT WITH Y, not the spelling
    // of the call.
    expect(tree.$.data.rows.all()).toHaveLength(1);
  });
});

/**
 * ## ENTITY-LINK-0 RESULT — the NULL is FALSIFIED
 *
 * ```text
 * collection carries a positionId from the tree's registry   ✓
 * collection carries its own ownerPath                       ✓
 * restoration reverses it as its own position                ✓
 * collection carries the REGISTRY back-reference             ✗ -> FIXED
 * ```
 *
 * So `entityMap` is ALREADY an independently addressable SignalTree position —
 * the topology, restoration and the notifier all treat it as one. The missing
 * registry is therefore **an ownership hole broader than `link()`**, and link
 * merely found it. It is the same class as OWNER-REPLAY-2's authored-collection
 * gap and the branch-accessor gap before it: a location that cannot name its
 * owning tree.
 *
 * And the substitute is not equivalent:
 *
 * ```text
 * link(tree.$.data, rowsEndpoint)
 *   fires for `page` and `selectedId`, which have nothing to do with rows
 *   sends { rows, selectedId, page } where the endpoint expects rows
 * ```
 *
 * Both the SYNCHRONISATION SCOPE and the VALUE SHAPE change. DEMARCATION-0's
 * "a spelling, not a capability" is withdrawn.
 *
 * ⚠️ WHAT THIS DOES NOT DECIDE. The fix is NOT "add a registry to collections so
 * link works" — that is the reasoning this audit refuses. The question is
 * whether every addressable position should name its owner, which is where the
 * invariant was already heading (`OWNER-REPLAY-2` narrowed it to VALUE-CARRYING
 * mutations, not to locations). Recorded for that decision, not taken here.
 */
