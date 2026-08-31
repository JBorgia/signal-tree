import { describe, expect, it } from 'vitest';

import { entityMap, signalTree } from '../index';

/**
 * M3 — IS A REALIZED VALUE'S STATE IDENTIFIABLE BY A UNIFORM RULE?
 *
 * Consumer separation is already done: four entry points share one memoised
 * representation, devtools owns its own transform, and a marker is not a
 * consumer at all. So the snapshot hook cannot be defended by divergent consumer
 * needs, and the remaining question is whether its ONE implementer —
 * `entityMap` — needs it because of what a COLLECTION IS, or because of how this
 * collection happens to be SHAPED.
 *
 * The distinction decides the disposition:
 *
 *   shape forced by the function   -> what survives is "a realized value must be
 *                                     able to declare its state when its shape
 *                                     hides it"
 *   shape is an implementation     -> the hook has no earned implementer, and
 *     choice                          conformance is the fix — exactly as it
 *                                     was for a marker
 */
type Row = { id: string; n: number };

describe('M3 — conformance', () => {
  it('MEASURE — representation is NOT uniform: the collection publishes an ENVELOPE', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      theme: 'light',
      plain: 1,
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });

    expect(tree()).toEqual({
      rows: { all: [{ id: 'a', n: 1 }] }, // <- a WRAPPER, not the value
      theme: 'light', // <- the value
      plain: 1, // <- the value
    });
  });

  it("THE HOOK'S STATED CAUSE is a shape accident, not a collection property", () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });

    // The docblock: "`ids`, `count`, `empty` and `map` are all derived from
    // `all` — and `map` is a JS Map, which JSON cannot represent, so it used to
    // serialise as `{}`: a snapshot claiming the collection was EMPTY while
    // holding 10,000 entities."
    //
    // That failure is only reachable because the walk meets an OBJECT and has to
    // guess which of its members is the state. A signal has nothing to guess
    // about: its state is what it returns.
    expect(tree.$.rows.asMap() instanceof Map).toBe(true);
    expect(JSON.parse(JSON.stringify(tree.$.rows.asMap()))).toEqual({});

    // Meanwhile the value the hook selects is exactly what a callable accessor
    // would have returned on its own.
    expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1 }]);
  });

  it('THE ENVELOPE CREATES THE AMBIGUITY IT RESOLVES', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    });

    // Both payload shapes are accepted, and the source says why: "An entityMap
    // SNAPSHOT always emits `{ all: [...] }`, so a bare array can never be
    // mistaken for the snapshot shape."
    tree({ rows: [{ id: 'x', n: 1 }] } as never);
    expect(tree.$.rows.ids()).toEqual(['x']);

    tree({ rows: { all: [{ id: 'y', n: 2 }] } } as never);
    expect(tree.$.rows.ids()).toEqual(['y']);

    // The disambiguation is only necessary because a SECOND canonical shape
    // exists. A conforming accessor publishes the array and there is nothing to
    // disambiguate.
  });
});
