import { describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { entityMap, signalTree } from '../index';

/**
 * M4 — IS A REALIZED VALUE RECONSTRUCTIBLE BY A UNIFORM RULE?
 *
 * The mirror of M3. M3 asked how a realized value PUBLISHES its state and found
 * the answer is uniform — it is what the accessor returns — with the hook
 * existing only where a declaration kind declines to conform.
 *
 * The `hydrate` hook has exactly two implementers: `entityMap` and
 * `asyncSource`. `asyncSource` is already a frozen DELETE, so on the far side of
 * that deletion `hydrate` reduces to ONE implementer, exactly as `snapshot` did.
 *
 * Per Rule 0l a legacy mechanism is an EVIDENCE REPOSITORY, so `asyncSource` is
 * measured here for what it reveals, not as a thing to preserve.
 */
type Row = { id: string; n: number };

describe('M4 — reconstruction', () => {
  it('THE COMMON FUNCTION — both implementers DECLINE when another authority owns the content', () => {
    // asyncSource, mode 'rehydrate': "Storage payload of unknown age; the loader
    // has already re-run and its result is newer." reason: 'loader-owns-source'.
    //
    // entityMap: "A LOADER-BACKED collection declines tree-level rehydration...
    // Writing the tree snapshot over it does not add a second opinion, it WINS
    // PERMANENTLY."
    //
    // Same shape in both: ownership, not representation. A uniform rule cannot
    // express it, because "set the position to the payload" has no way to know
    // another mechanism holds fresher truth.
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });

    // With NO loader attached there is no competing authority, and reconstruction
    // applies normally.
    tree({ rows: [{ id: 'b', n: 2 }] } as never);
    expect(tree.$.rows.ids()).toEqual(['b']);
  });

  // ⚠️ THE CONFORMANCE-SPECTRUM CASE IS GONE, AND ITS PREDICTION CAME TRUE.
  //
  // It used `asyncSource` as the spectrum's MIDDLE point — callable, but
  // `isSignal` false, carrying a MarkerProcessor symbol instead. This file's own
  // header predicted the consequence:
  //
  //   "The `hydrate` hook has exactly two implementers: `entityMap` and
  //    `asyncSource`. `asyncSource` is already a frozen DELETE, so on the far
  //    side of that deletion `hydrate` reduces to ONE implementer, exactly as
  //    `snapshot` did."
  //
  // ASYNC-SOURCE-RETIRE-1 is that far side. `hydrate` now has one implementer,
  // so the spectrum has no middle point left to measure and the row is retired
  // rather than re-subjected — there is no surviving marker with that shape.


});
