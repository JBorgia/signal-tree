import { describe, expect, it, vi } from 'vitest';

import { entityMap } from './markers/entity-map';
import { hydrateMarkerNode } from './internals/materialize-markers';
import { loader } from './markers/loader';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';

/**
 * MATRIX-CLOSE S3-RECOVER — the attempt to recover `currentHydrateMode()`'s own
 * claimed falsifier, and what it found instead.
 *
 * M6 forced `currentHydrateMode()` to `'merge'` permanently and the entire
 * 1885-test suite stayed green. Its source comment claims a specific measured
 * corruption:
 *
 *     n=3 rows=3   ->  undo  ->  n=2 rows=3
 *
 * i.e. a scalar reverts while a MARKER silently keeps its post-change value,
 * landing the user in a state that never existed. The rule for S3 was: recover
 * that exact case, and let the result decide keep-vs-delete. Do NOT invent a
 * different scenario that happens to make the branch matter.
 *
 * ## The recovery found something stronger than "the defect is gone"
 *
 * The branch CANNOT express the distinction it exists to make:
 *
 * ```text
 * currentHydrateMode() returns   'merge' | 'restore'
 * markers branch only on         'rehydrate'
 * ```
 *
 * `entity-map.ts` and `async-source.ts` each decline exactly one mode —
 * `mode === 'rehydrate'` — and `currentHydrateMode()` never produces it. So both
 * of its possible return values fall through the same path in every marker
 * processor. The value is computed and then no consumer can act on it.
 *
 * These two tests are the permanent record of that, so the deleted branch cannot
 * return on the strength of its own comment.
 */

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('S3-RECOVER: the historical n/rows corruption', () => {
  it('does not reproduce — the marker reverts with the scalar', async () => {
    const tree = signalTree(
      {
        n: 2,
        rows: entityMap<{ id: number }, number>({ selectId: (x) => x.id }),
      },
      { enhancers: [restoration()] }
    );
    undoable(() => {
      tree.$.rows.addOne({ id: 1 });
      tree.$.rows.addOne({ id: 2 });
    });
    await settle();

    // The authored change the comment describes: n 2 -> 3, rows 2 -> 3.
    undoable(() => {
      tree.$.n.set(3);
      tree.$.rows.addOne({ id: 3 });
    });
    await settle();
    expect({ n: tree.$.n(), rows: tree.$.rows.count() }).toEqual({
      n: 3,
      rows: 3,
    });

    tree.undo();
    await settle();

    // The corrupt hybrid the comment reports was `n=2 rows=3`. Both revert.
    expect({ n: tree.$.n(), rows: tree.$.rows.count() }).toEqual({
      n: 2,
      rows: 2,
    });
  });
});

describe("S3-RECOVER: why the branch could not have mattered", () => {
  it("'merge' and 'restore' are indistinguishable to every marker", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const make = () => {
      const tree = signalTree({
        r: entityMap<{ id: number }, number>({
          selectId: (x) => x.id,
          // A loader-backed marker is the ONLY thing that declines a payload, so
          // if any mode difference exists it has to show up here.
          load: loader(async () => [{ id: 9 }]),
        }),
      });
      void tree.$.r;
      return tree;
    };

    const underMerge = make();
    await settle();
    hydrateMarkerNode(underMerge.$.r, { all: [{ id: 1 }, { id: 2 }] }, 'merge');

    const underRestore = make();
    await settle();
    hydrateMarkerNode(
      underRestore.$.r,
      { all: [{ id: 1 }, { id: 2 }] },
      'restore'
    );

    // Identical. Both accept, because the decline is keyed on 'rehydrate' and
    // neither of these is it.
    expect(underMerge.$.r.count()).toBe(underRestore.$.r.count());
    expect(underMerge.$.r.count()).toBe(2);

    // And the mode that DOES discriminate, for contrast — this is the behaviour
    // the marker actually owns, and it is unreachable from the deleted branch.
    const underRehydrate = make();
    await settle();
    hydrateMarkerNode(
      underRehydrate.$.r,
      { all: [{ id: 1 }, { id: 2 }] },
      'rehydrate'
    );
    expect(underRehydrate.$.r.count()).not.toBe(2);
  });
});
