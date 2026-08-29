import { describe, expect, it } from 'vitest';

import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { signalTree } from './signal-tree';

/**
 * `DYN-ENTITY-OWNERSHIP-0` — the boundary between generic dynamic topology and
 * `entityMap`, pinned so it does not have to be rediscovered.
 *
 * Steps D–G made generic dynamic branches carry identity acquisition, keyed
 * selection, canonical identity reuse, remove/reactivate and flat churn. That
 * raised a fair question: does `entityMap` still own a distinct semantic job?
 *
 * It does, and the reason is structural rather than a missing feature. A
 * dynamic branch expresses membership as OBJECT PROPERTY KEYS, and JavaScript
 * fixes two things about those that no implementation can opt out of:
 *
 *   1. every key is a STRING
 *   2. integer-like keys enumerate FIRST, in ascending numeric order
 *
 * `entityMap` is documented and shipped with `entityMap<User, number>` as its
 * primary form, and it carries order as a contract (`all`, `ids`, `prependOne`,
 * `sortComparer`). Neither survives translation to property keys.
 *
 *     ORDER-BEARING TYPED-KEY IDENTITY IS NOT OBJECT-KEY MEMBERSHIP.
 *
 * These carriers assert what dynamic topology does NOT do. They are expected to
 * keep passing; if one ever fails, the domain boundary moved and the retirement
 * question is genuinely reopened.
 */

const DYN = Symbol('domain.dyn');
interface DynMarker {
  [DYN]: true;
  seed: Record<string, unknown>;
}
registerMarkerProcessor(
  (v: unknown): v is DynMarker =>
    typeof v === 'object' && v !== null && DYN in (v as object),
  (m: DynMarker) => ordinaryBranch(m.seed, { keyedLookup: true })
);
const CAPS = {
  capabilities: ['causal-runtime', 'position-topology'] as never,
  enhancers: [],
};
type Branch = Record<string, unknown> & ((v?: object) => unknown);

function emptyBranch(): Branch {
  const tree = signalTree(
    { c: { [DYN]: true, seed: {} } as DynMarker },
    CAPS
  ) as unknown as { $: { c: Branch } };
  const b = tree.$.c;
  void b();
  return b;
}
const keysOf = (b: Branch) => Object.keys(b() as object);

describe('dynamic topology vs entityMap — domain boundary', () => {
  it('numeric-like keys LOSE insertion order', () => {
    const b = emptyBranch();
    for (const id of ['30', '10', '20']) materializeMember(b, id, { n: 1 });

    // Inserted 30, 10, 20 — enumerated ascending. This is a JS object
    // invariant, not a SignalTree policy, so no dynamic-branch implementation
    // can preserve the caller's order for numeric ids.
    expect(keysOf(b)).toEqual(['10', '20', '30']);
  });

  it('non-numeric keys DO keep insertion order', () => {
    // The positive control: order is not lost in general, only for the
    // integer-like keys that entity ids overwhelmingly are.
    const b = emptyBranch();
    for (const id of ['c30', 'c10', 'c20']) materializeMember(b, id, { n: 1 });
    expect(keysOf(b)).toEqual(['c30', 'c10', 'c20']);
  });

  it('a key is always a string, never the number it was', () => {
    const b = emptyBranch();
    materializeMember(b, String(7), { n: 7 });
    const [key] = keysOf(b);
    expect(key).toBe('7');
    expect(typeof key).toBe('string');
    expect((key as unknown) === 7).toBe(false);
  });

  it('there is no prepend — acquisition always appends', () => {
    const b = emptyBranch();
    for (const id of ['b', 'c']) materializeMember(b, id, { n: 1 });
    materializeMember(b, 'a', { n: 1 });
    expect(keysOf(b)).toEqual(['b', 'c', 'a']);
  });
});
