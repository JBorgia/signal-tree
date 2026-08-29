import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';

import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { getOwnedPositionIds } from './internals/owned-metadata';
import { signalTree } from './signal-tree';

/**
 * `DYN-MATERIALIZE-REACTIVATION-0` — re-adding a removed dynamic member
 * reacquires the SAME canonical identity.
 *
 *     ACQUISITION IS CREATE-IF-NEVER-SEEN, REACTIVATE-IF-DORMANT,
 *     REUSE-IF-ACTIVE.
 *     IDENTITY DISCOVERY PRECEDES IDENTITY ACQUISITION.
 *
 * ⚠️ WHY THIS EXISTS. `materializeMember` used to call the owner-bound
 * constructor unconditionally. Membership was still correct and nothing
 * accumulated in the branch — but 1000 same-key add/remove cycles built 4000
 * PositionIds, 2000 membership carriers and 2000 memos, discarding a complete
 * canonical Location every cycle. Worse, ONE subject had TWO behaviours:
 * reactivation through whole-value assignment preserved identity, reactivation
 * through this path did not. That divergence is the defect these carriers pin;
 * the allocation count is only its most visible symptom.
 *
 * `ownKeys` and index cardinality were FLAT throughout, which is exactly why a
 * membership-shaped assertion could not catch this. The carriers below assert
 * IDENTITY and CONSTRUCTION COUNT, not presence.
 */

const DYN = Symbol('spec.dyn');
const KEY_INDEX = Symbol.for('SignalTree:DynamicKeyIndex');

interface DynMarker {
  [DYN]: true;
  seed: Record<string, unknown>;
}
const dyn = (seed: Record<string, unknown>): DynMarker => ({ [DYN]: true, seed });

registerMarkerProcessor(
  (v: unknown): v is DynMarker =>
    typeof v === 'object' && v !== null && DYN in (v as object),
  (m: DynMarker) => ordinaryBranch(m.seed, { keyedLookup: true })
);

const CAPS = {
  capabilities: ['causal-runtime', 'position-topology'] as never,
  enhancers: [],
};

type Users = Record<string, unknown> & ((v?: object) => unknown);

function makeBranch() {
  const tree = signalTree({ users: dyn({ seed: { v: 0 } }) }, CAPS) as unknown as {
    $: { users: Users };
  };
  const users = tree.$.users;
  void users(); // materialize the branch before anything is counted
  return users;
}

const SEED_ONLY = () => ({ seed: { v: 0 } });
const indexOf = (users: object) =>
  (users as Record<symbol, Map<string, unknown> | undefined>)[KEY_INDEX];

const MEMBER_MATERIALIZER = Symbol.for('SignalTree:MemberMaterializer');

/**
 * Counts calls to the branch's owner-bound constructor.
 *
 * ⚠️ NOT a global allocation counter. The first draft sampled a `G_pos` global
 * that only exists while the position registry is hand-instrumented; without
 * that patch it reads zero for every arm — including one that allocates 40,000
 * PositionIds — so the carrier would have passed by measuring nothing.
 * A BASELINE NOTHING VERIFIES IS A MEMO, NOT A GATE. Wrapping the authority the
 * branch actually holds needs no production change and cannot silently read
 * zero.
 */
function countConstructions(users: object): () => number {
  const slot = users as Record<symbol, unknown>;
  const real = slot[MEMBER_MATERIALIZER] as (k: string, v: unknown) => unknown;
  let calls = 0;
  Object.defineProperty(users, MEMBER_MATERIALIZER, {
    value: (k: string, v: unknown) => {
      calls++;
      return real(k, v);
    },
    configurable: true,
  });
  return () => calls;
}

describe('DYN-MATERIALIZE-REACTIVATION-0', () => {
  // ── Carrier 1: dormant re-add returns the SAME Location ──────────────────
  it('re-adding a removed key returns the identical Location object', () => {
    const users = makeBranch();
    const first = materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    (users as (v: object) => unknown)(SEED_ONLY()); // remove
    const second = materializeMember(users, 'bob', { profile: { name: 'Bob' } });

    expect(second).toBe(first);
  });

  // ── Carrier 2: same PositionId ───────────────────────────────────────────
  it('the reacquired member keeps its original PositionId', () => {
    const users = makeBranch();
    const first = materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    const before = getOwnedPositionIds(first);
    expect(before?.length).toBeGreaterThan(0); // the carrier is only meaningful
                                               // if positions exist at all

    (users as (v: object) => unknown)(SEED_ONLY());
    const second = materializeMember(users, 'bob', { profile: { name: 'Bob' } });

    expect(getOwnedPositionIds(second)).toEqual(before);
  });

  // ── Carrier 3: the index keeps ONE canonical entry, not a replacement ────
  it('the dynamic index entry is reused, not rewritten', () => {
    const users = makeBranch();
    const first = materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    const index = indexOf(users);
    expect(index?.get('bob')).toBe(first);

    (users as (v: object) => unknown)(SEED_ONLY());
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });

    // Same Map object, same size, same value — no shadow entry, no wrapper.
    expect(indexOf(users)).toBe(index);
    expect(index?.size).toBe(2); // seed + bob
    expect(index?.get('bob')).toBe(first);
  });

  // ── Carrier 4: the SUPPLIED value wins over the retained one ─────────────
  it('re-adding with a new value installs the new value, not the retained one', () => {
    const users = makeBranch();
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    (users as (v: object) => unknown)(SEED_ONLY());
    materializeMember(users, 'bob', { profile: { name: 'Robert' } });

    expect((users() as Record<string, { profile: { name: string } }>)['bob']).toEqual({
      profile: { name: 'Robert' },
    });
  });

  // ── Carrier 5: same-value reactivation still wakes a HELD consumer ───────
  it('re-adding with an unchanged value notifies an already-subscribed consumer', () => {
    // ⚠️ A FRESH READ CANNOT CARRY THIS. Re-reading `users()` after the write
    // rebuilds from current membership and passes even when the memo is stale,
    // which is how three earlier membership carriers went vacuous.
    // REACTIVITY CONTRACTS MUST BE TESTED THROUGH A HELD CONSUMER.
    const users = makeBranch();
    const value = { profile: { name: 'Bob' } };
    materializeMember(users, 'bob', value);

    const observed = computed(() => Object.keys(users() as object).sort());
    expect(observed()).toEqual(['bob', 'seed']);

    (users as (v: object) => unknown)(SEED_ONLY());
    expect(observed()).toEqual(['seed']);

    // Identical value: the value write commits nothing, so ONLY the membership
    // transition can wake this consumer.
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    expect(observed()).toEqual(['bob', 'seed']);
  });

  // ── Carrier 6: exactly ONE membership publication per reacquisition ──────
  it('reacquisition publishes membership exactly once', () => {
    const users = makeBranch();
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    (users as (v: object) => unknown)(SEED_ONLY());

    let rebuilds = 0;
    const observed = computed(() => {
      rebuilds++;
      return Object.keys(users() as object).length;
    });
    observed();
    const base = rebuilds;

    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    observed();

    expect(rebuilds - base).toBe(1);
  });

  // ── Carrier 7: reacquisition constructs NOTHING ─────────────────────────
  it('reacquisition never re-enters the owner-bound constructor', () => {
    const users = makeBranch();
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    (users as (v: object) => unknown)(SEED_ONLY());

    const constructions = countConstructions(users);
    materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    expect(constructions()).toBe(0);

    // Positive control: the SAME spy does count a genuinely new key, so a zero
    // above means "did not construct", not "is not watching".
    materializeMember(users, 'carol', { profile: { name: 'Carol' } });
    expect(constructions()).toBe(1);
  });

  // ── ME-A: an ACTIVE existing key also takes the supplied value ───────────
  it('materializing an ACTIVE key reuses its identity and applies the value', () => {
    // ME-A, not ME-B: the operation already accepts `value`, so one coherent
    // rule covers all three states — never seen -> create + value; dormant ->
    // reactivate + value; active -> existing identity + value.
    const users = makeBranch();
    const first = materializeMember(users, 'bob', { profile: { name: 'Bob' } });
    const again = materializeMember(users, 'bob', { profile: { name: 'Robert' } });

    expect(again).toBe(first);
    expect((users() as Record<string, { profile: { name: string } }>)['bob']).toEqual({
      profile: { name: 'Robert' },
    });
  });
});
