import { describe, expect, it } from 'vitest';

import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { signalTree } from './signal-tree';

/**
 * `ACCESSOR/STORE COHERENCE MUST HAVE ONE MUTATION OWNER.`
 *
 * A branch is ONE semantic object and TWO physical ones — the `NodeAccessor`
 * consumers hold, and the backing store its call path closes over. Both carry a
 * descriptor per member and BOTH ARE OBSERVABLE:
 *
 * ```text
 * store      branch(), every snapshot, every memo
 * accessor   Object.keys(branch), 'k' in branch, { ...branch }
 * ```
 *
 * ⚠️ THREE SEPARATE BUGS CAME FROM SPLITTING THIS ACROSS CALLERS — first
 * appearance defining only the accessor, dynamic reacquisition activating only
 * the accessor, and then the worst one, found by measurement while extracting
 * the convergence helper: NO deactivation path had EVER touched the accessor.
 * After `user({ name: 'A' })` removed `age`, the snapshot correctly said
 * `["name"]` while `Object.keys($.user)` and `{ ...$.user }` both still said
 * `["age", "name"]` — PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE
 * STATE, and this was one.
 *
 * The callers were not careless; each held whichever half was natural at its
 * own site. "Also update the other one" is not a property a call site can be
 * trusted to carry, so `setMemberPresence` owns both halves and the
 * single-object primitives are no longer exported.
 *
 * These carriers assert the two halves AGREE. They are deliberately written
 * against the observable surfaces rather than the descriptors, because the
 * descriptors are the mechanism and the surfaces are the contract.
 */

const DYN = Symbol('coherence.dyn');
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

/** The three accessor-side surfaces, which must agree with the snapshot. */
function accessorKeys(branch: Branch): string[] {
  return Object.keys(branch).sort();
}
function snapshotKeys(branch: Branch): string[] {
  return Object.keys(branch() as object).sort();
}

describe('accessor/store membership coherence', () => {
  it('a static branch agrees across removal and re-add', () => {
    const tree = signalTree({ user: { name: 'A', age: 1 } }, CAPS) as unknown as {
      $: { user: Branch };
    };
    const user = tree.$.user;
    void user();
    expect(accessorKeys(user)).toEqual(snapshotKeys(user));

    user({ name: 'A' }); // remove `age`
    expect(snapshotKeys(user)).toEqual(['name']);
    expect(accessorKeys(user)).toEqual(['name']);
    // String keys only: the accessor also carries an enumerable
    // `Symbol(SignalTree:NodeAccessor)` brand, which spread copies and
    // `Object.keys` does not. That symbol is not membership.
    expect(Object.keys({ ...user }).sort()).toEqual(['name']);

    user({ name: 'A', age: 2 }); // re-add
    expect(snapshotKeys(user)).toEqual(['age', 'name']);
    expect(accessorKeys(user)).toEqual(['age', 'name']);
  });

  it('the retained Location survives removal without being a member', () => {
    // Physical retention is INTENTIONAL and must remain reachable — this is the
    // distinction the coherence fix must not flatten. `age` stops being a
    // member; it does not stop existing.
    const tree = signalTree({ user: { name: 'A', age: 1 } }, CAPS) as unknown as {
      $: { user: Branch };
    };
    const user = tree.$.user;
    void user();
    user({ name: 'A' });

    expect(accessorKeys(user)).toEqual(['name']); // not a member
    expect('age' in user).toBe(true); // but still present
    expect(typeof user['age']).toBe('function'); // and still a Location
  });

  it('a dynamic branch agrees across materialize, removal and reacquisition', () => {
    const tree = signalTree(
      { users: { [DYN]: true, seed: { seed: { v: 0 } } } as DynMarker },
      CAPS
    ) as unknown as { $: { users: Branch } };
    const users = tree.$.users;
    void users();

    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    expect(accessorKeys(users)).toEqual(snapshotKeys(users));
    expect(snapshotKeys(users)).toEqual(['bob', 'seed']);

    (users as (v: object) => unknown)({ seed: { v: 0 } });
    expect(snapshotKeys(users)).toEqual(['seed']);
    expect(accessorKeys(users)).toEqual(['seed']);

    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    expect(snapshotKeys(users)).toEqual(['bob', 'seed']);
    expect(accessorKeys(users)).toEqual(['bob', 'seed']);
  });

  it('a leaf waking through its own set() agrees on both halves', () => {
    // `reactivateOnWrite` is the third transition path, and it reaches
    // membership from the CHILD rather than from either half of the parent.
    const tree = signalTree({ user: { name: 'A', age: 1 } }, CAPS) as unknown as {
      $: { user: Branch };
    };
    const user = tree.$.user;
    void user();
    user({ name: 'A' });
    expect(accessorKeys(user)).toEqual(['name']);

    (user['age'] as { set(v: number): void }).set(99);
    expect(snapshotKeys(user)).toEqual(['age', 'name']);
    expect(accessorKeys(user)).toEqual(['age', 'name']);
  });

  it('the single-object primitives are not reachable', async () => {
    // The whole point of the helper is that `activateMember(accessor, key)`
    // cannot be written at a call site. If these are ever re-exported, the
    // structural guarantee is gone even while every carrier above still passes.
    const mod = (await import('./internals/member-membership')) as Record<
      string,
      unknown
    >;
    expect(mod['activateMember']).toBeUndefined();
    expect(mod['deactivateMember']).toBeUndefined();
    expect(typeof mod['setMemberPresence']).toBe('function'); // positive control
  });
});
