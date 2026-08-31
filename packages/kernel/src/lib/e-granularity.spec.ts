import { describe, expect, it } from 'vitest';

import { signalTree } from './signal-tree';
import { entityMap } from './types';

/**
 * DERIVATION E — the collection null.
 *
 * The zero-state left exactly two candidate surviving functions: GRANULAR WRITE
 * (E-e) and GRANULAR OBSERVATION (E-f). Everything else a collection asks for is
 * already answered by ordinary canonical state or by frozen architecture.
 *
 * So the null is: can those two be obtained WITHOUT a collection primitive?
 *
 * Three shapes, same question. Recomputation is counted by a `computed` that
 * reads exactly one entry; if it re-runs when a DIFFERENT entry changes,
 * observation is not granular.
 */
type Row = { id: string; n: number };

describe('E — is granular write/observation obtainable without a collection primitive?', () => {
  it('RECORD: granular WRITE too — one entry changes without rewriting the rest', () => {
    const tree = signalTree({
      rows: { a: { id: 'a', n: 1 }, b: { id: 'b', n: 1 } },
    });
    const beforeA = tree.$.rows.a();

    tree.$.rows.b.n.set(42);

    // `a` is untouched, by identity — not merely by value.
    expect(tree.$.rows.a()).toBe(beforeA);
  });

});

/**
 * E-d IN ITS HARDEST FORM — identity across a KEY CHANGE.
 *
 * Granular write and observation fell to an ordinary record. What a record
 * cannot obviously express is "the key changed but it is the SAME subject",
 * which is where the frozen SubjectId concept lives.
 */
describe('E — the 2x2: membership vs granularity', () => {
  it('ARRAY: dynamic membership YES (add and remove both work)', () => {
    const tree = signalTree({ rows: [{ id: 'a', n: 1 }] as Row[] });

    tree.$.rows.set([...tree.$.rows(), { id: 'b', n: 2 }]);
    expect(tree.$.rows().map((r) => r.id)).toEqual(['a', 'b']);

    tree.$.rows.set(tree.$.rows().filter((r) => r.id !== 'a'));
    expect(tree.$.rows().map((r) => r.id)).toEqual(['b']);
  });
});

describe('E — identity across a key change', () => {
  it('RECORD: membership is FIXED AT CONSTRUCTION — no add, no remove', () => {
    const tree = signalTree({
      rows: { a: { id: 'a', n: 1 } } as Record<string, { id: string; n: number }>,
    });

    // A nested accessor is not a settable signal; it is a callable that merges.
    expect(
      (tree.$.rows as unknown as Record<string, unknown>)['set']
    ).toBeUndefined();

    (tree.$.rows as unknown as (v: object) => void)({ b: { id: 'b', n: 1 } });

    const now = tree.$.rows() as Record<string, unknown>;

    // MEASURED: `b` was NOT added. The tree materialises `rows` with the keys
    // present at construction, and a write reaches only those positions.
    expect(now['b']).toBeUndefined();

    // ⚠️ UPDATED IN 15.0 — the REMOVE half of this record no longer holds.
    //
    // This originally read `expect(now['a']).toEqual({ id: 'a', n: 1 })`, on the
    // reasoning that a partial write "reaches only those positions" and so left
    // `a` alone. Under GREENFIELD-BRANCH-WRITE-0 the argument is a WHOLE VALUE,
    // so a key it omits is not a member of it — `a` is now semantically absent.
    // Nothing was written to `a`; its slot and retained value survive, dormant.
    expect(now['a']).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(now, 'a')).toBe(false);

    // The ADD half is a separate, still-unresolved discriminator — see the
    // expected-failure carrier below, which executes the TARGET claim rather
    // than asserting the incumbent observation.
  });

  // ⚠️ C5-OPEN-KEY-WHOLE-VALUE-0 — UNRESOLVED. EXPECTED-FAILURE TARGET.
  //
  //     AN UNRESOLVED TARGET MUST EXECUTE THE TARGET CLAIM,
  //     NOT ASSERT THE KNOWN-WRONG OBSERVATION.
  //
  // An earlier revision of this file wrote `expect(now['b']).toBeUndefined()`
  // with a comment saying "this is really red". That is a PASSING assertion of
  // the incumbent defect: the prose said unresolved while the executable claim
  // said "b absent is success", so satisfying BR-A would have turned the suite
  // red and looked like a regression.
  //
  // The state is declared `Record<string, Row>`, so `{ b }` IS a complete value
  // of this location's type. Under
  //
  //     THE LOCATION TYPE DEFINES WHAT CONSTITUTES A COMPLETE VALUE
  //
  // the result must be exactly `{ b }`. Today `b` is discarded because no
  // position for it was materialised at construction — the same authority error
  // as `Partial<T>`, pointing the other way: the physical shape overriding what
  // `T` says a complete value is.
  //
  // Preregistered dispositions: OPEN-A dynamic materialisation · OPEN-B1 whole
  // dynamic value representation · OPEN-B2 redirect open-key types at the
  // authoring boundary · OPEN-C (initial keys secretly define legal keys)
  // INADMISSIBLE.
  //
  // ⚠️ WHEN THIS STARTS PASSING, THE SUITE GOES RED and `.fails` must be
  // removed. That is the point: nobody has to remember to flip a flag.
  it.fails('OPEN-KEY: a Record whole assignment installs the complete T', () => {
    const tree = signalTree({
      rows: { a: { id: 'a', n: 1 } } as Record<string, { id: string; n: number }>,
    });

    (tree.$.rows as unknown as (v: object) => void)({ b: { id: 'b', n: 1 } });

    expect(tree.$.rows()).toEqual({ b: { id: 'b', n: 1 } });
  });

  it('entityMap: changeId preserves the row across the key change', () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; n: number }, string>({
        selectId: (r) => r.id,
      }),
    });
    tree.$.rows.addOne({ id: 'a', n: 1 });

    tree.$.rows.changeId('a', 'b');

    expect(tree.$.rows.ids()).toEqual(['b']);
    expect(tree.$.rows.byIdOrFail('b').n()).toBe(1);
  });
});
