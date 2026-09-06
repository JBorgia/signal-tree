import { describe, expect, it } from 'vitest';

import { createReactiveTestRealization } from '../reactive-test-realization';
import { acquireScalarProjection, EXTERNAL_ACQUISITION } from './internals/acquire-projection';
import { createSignalTreeFactory, signalTree } from './signal-tree';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { getPositionRegistry } from './internals/position-registry';
import {
  clearProductionSubstrateStatsForTesting,
  installProductionSubstrateStatsForTesting,
  resetProductionSubstrateStatsForTesting,
} from './internals/production-substrate-stats';

const testRealization = createReactiveTestRealization();
const reactiveSignalTree = createSignalTreeFactory(testRealization);
const computed = testRealization.locations.createDerived;

/**
 * C5-WHOLE-VALUE-MEMBERSHIP — GREENFIELD-BRANCH-WRITE-0.
 *
 *     OMISSION IN A WHOLE VALUE CHANGES MEMBERSHIP.
 *     OMISSION IN A PROJECTION DEFINES SCOPE.
 *
 *     PHYSICAL RETENTION MUST NOT CREATE A SECOND OBSERVABLE STATE.
 *     A DESCENDANT ABSENT FROM ITS PARENT'S CURRENT VALUE IS SEMANTICALLY
 *     ABSENT EVEN IF ITS PHYSICAL LOCATION IS RETAINED.
 *
 * ⚠️ Every case here supplies a value that OMITS a key. The C5 carriers written
 * first could not discriminate merge from whole-value assignment, because they
 * all re-supplied every key — both rules produce the same result then.
 */
describe('whole-value membership', () => {
  it('1 — an OPTIONAL member omitted from a whole value becomes absent', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } }, { capabilities: ['causal-runtime'] });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });

    const value = tree.$.user() as Record<string, unknown>;
    expect(value).toEqual({ name: 'Dave' });
    expect(Object.prototype.hasOwnProperty.call(value, 'age')).toBe(false);
    // Not a second observable truth: the direct read agrees with the snapshot.
    expect(tree.$.user.age()).toBeUndefined();
  });

  it('2 — a Partial-shaped STATE behaves identically', () => {
    // The author declared a partial-SHAPED state. They did not request partial
    // WRITES: a value call still assigns the whole value of this location.
    const tree = signalTree({
      user: { name: 'Ada', age: 42 } as Partial<{ name: string; age: number }>,
    });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });

    expect(tree.$.user()).toEqual({ name: 'Dave' });
  });

  it('3 — an UPDATER returns the whole next value, so its omissions count', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } }, { capabilities: ['causal-runtime'] });

    (tree.$.user as unknown as (f: (c: unknown) => object) => void)(() => ({
      name: 'Dave',
    }));

    expect(tree.$.user()).toEqual({ name: 'Dave' });
    expect(tree.$.user.age()).toBeUndefined();
  });

  it('4 — ROOT parity', () => {
    const tree = signalTree({ a: 1, b: 2 as number | undefined });

    tree.$({ a: 9 } as never);

    const value = tree.$() as Record<string, unknown>;
    expect(value).toEqual({ a: 9 });
    expect(Object.prototype.hasOwnProperty.call(value, 'b')).toBe(false);
  });

  it('5 — absence is NOT a fabricated undefined write', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } }, { capabilities: ['causal-runtime'] });
    const changed = (tree.updateAndReport?.({
      user: { name: 'Dave' },
    } as never) ?? []) as string[];
    const seen: string[] = [...changed];

    // `user.age` must NOT appear as a changed path: nothing was written to it.
    expect(seen).not.toContain('user.age');
    expect(tree.$.user()).toEqual({ name: 'Dave' });
  });

  it('6 — SUCCESSOR: the parent reintroduces the member with the supplied value', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } }, { capabilities: ['causal-runtime'] });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(tree.$.user.age()).toBeUndefined();

    (tree.$.user as unknown as (v: object) => void)({ name: 'Grace', age: 50 });

    // 50, never the dormant 42 — reactivation carries the supplied value.
    expect(tree.$.user()).toEqual({ name: 'Grace', age: 50 });
    expect(tree.$.user.age()).toBe(50);
  });

  it('7 — SUCCESSOR: an authored write to a dormant member reactivates it', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } }, { capabilities: ['causal-runtime'] });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(tree.$.user()).toEqual({ name: 'Dave' });

    tree.$.user.age(50);

    // WRITING AN ABSENT DESCENDANT REACTIVATES ITS MEMBERSHIP — otherwise the
    // write would mutate hidden storage while the parent kept omitting it, which
    // is the two-observable-truths defect in the other direction.
    expect(tree.$.user.age()).toBe(50);
    expect(tree.$.user()).toEqual({ name: 'Dave', age: 50 });
  });

  it('7b — SAME-VALUE parent reintroduction wakes an existing subscriber', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );
    const observed = computed(() => tree.$.user.age());
    expect(observed()).toBe(42);

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(observed()).toBeUndefined();

    // ⚠️ THE SAME VALUE THE DORMANT SLOT ALREADY HOLDS.
    //
    //     SEMANTIC MEMBERSHIP CHANGE IS AN OBSERVABLE SLOT CHANGE EVEN WHEN THE
    //     RETAINED VALUE IS IDENTICAL.
    //
    // The ordinary write path suppresses an unchanged commit, so routing
    // activation through the value comparator would leave this consumer stuck
    // at `undefined` forever — the failure is invisible with any other value.
    (tree.$.user as unknown as (v: object) => void)({ name: 'Grace', age: 42 });

    expect(observed()).toBe(42);
    expect(tree.$.user()).toEqual({ name: 'Grace', age: 42 });
  });

  it('9 — SAME-VALUE child reactivation wakes an existing subscriber', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );
    const observed = computed(() => tree.$.user.age());
    expect(observed()).toBe(42);

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(observed()).toBeUndefined();

    // Writing the dormant slot's OWN value back through the child.
    tree.$.user.age(42);

    expect(observed()).toBe(42);
    expect(tree.$.user()).toEqual({ name: 'Dave', age: 42 });
  });

  it('10 — DEACTIVATION wakes an existing subscriber and retains the slot', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );
    const observed = computed(() => tree.$.user.age());
    expect(observed()).toBe(42);

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });

    expect(observed()).toBeUndefined();
    // The slot is retained, not destroyed: re-supplying the SAME value proves
    // the location survived rather than being rebuilt from scratch.
    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave', age: 42 });
    expect(observed()).toBe(42);
  });

  it('12 — HELD PARENT + CHILD consumers across the full membership cycle', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );

    // ⚠️ SUBSCRIBED ONCE, NEVER RECREATED. A fresh `tree.$.user()` call after
    // each transition passes even when every held consumer is permanently
    // stale — measured, and it is why the earlier successor carriers were
    // insufficient on their own.
    const parentObserved = computed(() => tree.$.user());
    const childObserved = computed(() => tree.$.user.age());

    expect(parentObserved()).toEqual({ name: 'Ada', age: 42 });
    expect(childObserved()).toBe(42);

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(parentObserved()).toEqual({ name: 'Dave' });
    expect(childObserved()).toBeUndefined();

    // The SAME value the dormant slot still holds — no value inequality to lean
    // on, in either the child's publication or the parent's dependency graph.
    tree.$.user.age(42);
    expect(childObserved()).toBe(42);
    expect(parentObserved()).toEqual({ name: 'Dave', age: 42 });
  });

  it('13 — HELD consumers across SAME-VALUE parent reintroduction', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );
    const parentObserved = computed(() => tree.$.user());
    const childObserved = computed(() => tree.$.user.age());
    expect(parentObserved()).toEqual({ name: 'Ada', age: 42 });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(childObserved()).toBeUndefined();

    (tree.$.user as unknown as (v: object) => void)({ name: 'Grace', age: 42 });

    expect(parentObserved()).toEqual({ name: 'Grace', age: 42 });
    expect(childObserved()).toBe(42);
  });

  it('14 — a dormant UPDATER receives the SEMANTIC current value, not retained storage', () => {
    const tree = signalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    // The physical slot still holds 42; the member is semantically absent.

    const seen: Array<number | undefined> = [];
    tree.$.user.age((current) => {
      seen.push(current);
      return 50;
    });

    // AN UPDATER RECEIVES THE SEMANTIC CURRENT VALUE, NOT DORMANT PHYSICAL
    // STORAGE. Handing it 42 would make retained storage a second semantic
    // truth through the one door still open to it.
    expect(seen).toEqual([undefined]);
    expect(tree.$.user()).toEqual({ name: 'Dave', age: 50 });
    expect(tree.$.user.age()).toBe(50);
  });

  it('15 — an ACTIVE updater still receives its real current value', () => {
    const tree = signalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );
    const seen: Array<number | undefined> = [];

    tree.$.user.age((current) => {
      seen.push(current);
      return (current ?? 0) + 1;
    });

    expect(seen).toEqual([42]);
    expect(tree.$.user.age()).toBe(43);
  });

  it('16 — one semantic slot transition publishes ONCE, for either reason or both', () => {
    // ⚠️ changedSlots = value-changed UNION membership-changed, published once.
    //
    // Measured before this was enforced: a same-value child reactivation emitted
    // THREE publications — two from sweeping every slot under the branch, one
    // from the caller. The union now converges by CONSTRUCTION rather than by
    // accumulation: activation happens inside the leaf's own write path, so the
    // parent's membership reconciliation afterwards finds the key already
    // enumerable and adds nothing.
    const make = () => {
      const tree = reactiveSignalTree(
        { user: { name: 'Ada', age: 42 as number | undefined } },
        { capabilities: ['causal-runtime'] }
      );
      const parent = computed(() => tree.$.user());
      const child = computed(() => tree.$.user.age());
      parent();
      child();
      return { tree, parent, child };
    };
    const measure = (fn: () => void) => {
      const stats = installProductionSubstrateStatsForTesting();
      resetProductionSubstrateStatsForTesting(stats);
      fn();
      const out = stats.publications;
      clearProductionSubstrateStatsForTesting();
      return out;
    };
    const dormant = (h: ReturnType<typeof make>) => {
      (h.tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
      h.parent();
      h.child();
    };

    // A — membership only, via the child, same value
    const a = make(); dormant(a);
    expect(measure(() => a.tree.$.user.age(42))).toBe(1);

    // B — membership only, via the parent, same value
    const b = make(); dormant(b);
    expect(
      measure(() =>
        (b.tree.$.user as unknown as (v: object) => void)({ name: 'Dave', age: 42 })
      )
    ).toBe(1);

    // C — value AND membership together: the discriminator.
    const c = make(); dormant(c);
    expect(
      measure(() =>
        (c.tree.$.user as unknown as (v: object) => void)({ name: 'Dave', age: 50 })
      )
    ).toBe(1);
    expect(c.child()).toBe(50);
    expect(c.parent()).toEqual({ name: 'Dave', age: 50 });

    // D — value only, member already active
    const d = make();
    expect(
      measure(() =>
        (d.tree.$.user as unknown as (v: object) => void)({ name: 'Ada', age: 50 })
      )
    ).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ⚠️ BRANCH-SHAPED MEMBERS. Every case above omits `age` — a LEAF.
  //
  //     A MATRIX WITH MANY TESTS CAN STILL BE ONE-DIMENSIONAL.
  //     ENUMERATE SUBJECT SHAPES, NOT JUST CASE COUNT.
  //
  // Sixteen green leaf carriers and one mutation-proven falsifier did not
  // establish branch membership at all. Measured on a plain static tree with no
  // markers: `box({ keep })` omitting `drop` left `box.drop()` returning
  // `{v:2}` AND `box()` still listing `drop`. Both halves were broken.
  //
  //     EVERY MEMBERSHIP CARRIER MUST INCLUDE AT LEAST ONE STRUCTURAL MEMBER.
  // ─────────────────────────────────────────────────────────────────────────
  it('17 — an omitted BRANCH member becomes absent, physically retained', () => {
    const tree = signalTree(
      { box: { keep: { v: 1 }, drop: { v: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    const drop = tree.$.box.drop;
    const dropPos = getOwnedPositionIds(drop)?.[0];
    const reg = getPositionRegistry(tree.$ as object);

    // ⚠️ BUILD THE PARENT MEMO FIRST. Without this read the memo does not exist
    // yet, so its staleness cannot be observed — measured: removing the
    // tokenless-invalidation repair left this carrier GREEN until the memo was
    // established before the write. MEASURE THE OPERATION AFTER ITS
    // PREREQUISITES HAVE BEEN ESTABLISHED.
    expect(tree.$.box()).toEqual({ keep: { v: 1 }, drop: { v: 2 } });

    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 1 } });

    // semantic absence, at BOTH the parent snapshot and the direct read
    expect(tree.$.box()).toEqual({ keep: { v: 1 } });
    expect((tree.$() as Record<string, unknown>)['box']).toEqual({ keep: { v: 1 } });
    expect((drop as unknown as () => unknown)()).toBeUndefined();

    // physical retention
    expect(tree.$.box.drop).toBe(drop);
    expect(getOwnedPositionIds(drop)?.[0]).toBe(dropPos);
    expect(getPositionRegistry(drop as object)?.id).toBe(reg?.id);
  });

  it('18 — a reactivated BRANCH keeps identity and takes the SUPPLIED value', () => {
    const tree = signalTree(
      { box: { keep: { v: 1 }, drop: { v: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    const drop = tree.$.box.drop;
    const dropPos = getOwnedPositionIds(drop)?.[0];

    expect(tree.$.box()).toEqual({ keep: { v: 1 }, drop: { v: 2 } });
    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 1 } });
    expect(tree.$.box()).toEqual({ keep: { v: 1 } });
    expect((drop as unknown as () => unknown)()).toBeUndefined();

    // DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE — retained is {v:2}.
    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 1 }, drop: { v: 9 } });

    expect(tree.$.box.drop).toBe(drop);
    expect(getOwnedPositionIds(drop)?.[0]).toBe(dropPos);
    expect((drop as unknown as () => unknown)()).toEqual({ v: 9 });
    expect(tree.$.box()).toEqual({ keep: { v: 1 }, drop: { v: 9 } });
  });

  it('19 — a HELD parent consumer sees BRANCH removal and reactivation', () => {
    // ⚠️ THE MISSING AXIS. Carriers 17/18 re-read `tree.$.box()` fresh, which
    // rebuilds through the memo table and therefore passed while a HELD
    // consumer stayed permanently stale — measured: after omitting `drop`, a
    // held `computed(() => box())` still reported `{keep, drop}` while `drop()`
    // correctly returned `undefined`. Two observable answers.
    //
    //     REACTIVITY CONTRACTS MUST BE TESTED THROUGH A HELD CONSUMER,
    //     NOT ONLY BY RE-READING THE SOURCE.
    const tree = reactiveSignalTree(
      { box: { keep: { v: 1 }, drop: { v: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    const held = computed(() =>
      JSON.stringify((tree.$.box as unknown as () => unknown)())
    );
    const drop = tree.$.box.drop;
    const dropPos = getOwnedPositionIds(drop)?.[0];

    expect(JSON.parse(held())).toEqual({ keep: { v: 1 }, drop: { v: 2 } });

    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 1 } });
    expect(JSON.parse(held())).toEqual({ keep: { v: 1 } });
    expect((drop as unknown as () => unknown)()).toBeUndefined();

    // reactivate with a NEW value — same identity, supplied value wins
    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 1 }, drop: { v: 9 } });
    expect(JSON.parse(held())).toEqual({ keep: { v: 1 }, drop: { v: 9 } });
    expect(tree.$.box.drop).toBe(drop);
    expect(getOwnedPositionIds(drop)?.[0]).toBe(dropPos);
  });

  it('20 — an ordinary value write must NOT be a membership transition', () => {
    // Guards against making membership observation a generic branch-write tax.
    const tree = reactiveSignalTree(
      { box: { keep: { v: 1 }, other: { v: 2 } } },
      { capabilities: ['causal-runtime', 'position-topology'] }
    );
    // ⚠️ COUNTS RECOMPUTATIONS, NOT VALUES. An earlier version asserted only the
    // resulting snapshot, so publishing a membership event on EVERY branch write
    // passed it — the values stay correct, only the invalidation is overbroad.
    let rebuilds = 0;
    const held = computed(() => {
      rebuilds++;
      return JSON.stringify((tree.$.box as unknown as () => unknown)());
    });
    expect(JSON.parse(held())).toEqual({ keep: { v: 1 }, other: { v: 2 } });
    const afterFirst = rebuilds;

    // A value write must reach the snapshot through ordinary slot publication.
    tree.$.box.keep.v(5);
    expect(JSON.parse(held())).toEqual({ keep: { v: 5 }, other: { v: 2 } });
    const afterValueWrite = rebuilds;

    // A WHOLE-VALUE write that changes NO membership must not invalidate the
    // membership carrier: both keys are supplied, so nothing left or arrived.
    (tree.$.box as unknown as (v: object) => void)({ keep: { v: 5 }, other: { v: 2 } });
    expect(held()).toBe(held());
    expect(rebuilds).toBe(afterValueWrite);
    expect(afterValueWrite).toBeGreaterThan(afterFirst);
  });

  it('8 — C4 CONTROL: a projection omitting a key changes NO membership', () => {
    const tree = signalTree({ box: { a: 0, b: 0, c: 0 } });

    acquireScalarProjection(
      tree.$.box as unknown as Record<string, unknown>,
      { a: 10, c: 30 },
      EXTERNAL_ACQUISITION
    );

    // Omission here is SCOPE, not value semantics: `b` is untouched and still a
    // member. This is the line that must never blur.
    expect(tree.$.box()).toEqual({ a: 10, b: 0, c: 30 });
    expect(tree.$.box.b()).toBe(0);
  });

  it('FIRST-DEACTIVATION CONTROL — the SAME subscribed consumer reacts', () => {
    const tree = reactiveSignalTree(
      { user: { name: 'Ada', age: 42 as number | undefined } },
      { capabilities: ['causal-runtime'] }
    );

    // Subscribed BEFORE any transition and never recreated.
    const observed = computed(() => tree.$.user.age());
    expect(observed()).toBe(42);

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });
    expect(observed()).toBeUndefined();

    (tree.$.user as unknown as (v: object) => void)({ name: 'Grace', age: 50 });
    expect(observed()).toBe(50);
  });
});

describe('whole-value membership — PUBLIC DEFAULT PATH', () => {
  it('PUBLIC DEFAULT: a plain signalTree carries whole-value membership', () => {
    const tree = signalTree({ user: { name: 'Ada', age: 42 as number | undefined } });

    const parent = computed(() => tree.$.user());
    const child = computed(() => tree.$.user.age());
    expect(parent()).toEqual({ name: 'Ada', age: 42 });

    (tree.$.user as unknown as (v: object) => void)({ name: 'Dave' });

    expect(parent()).toEqual({ name: 'Dave' });
    expect(child()).toBeUndefined();

    tree.$.user.age(42); // the same value the dormant slot holds
    expect(child()).toBe(42);
    expect(parent()).toEqual({ name: 'Dave', age: 42 });
  });
});
