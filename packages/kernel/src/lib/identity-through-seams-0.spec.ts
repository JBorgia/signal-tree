import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import { link } from './link';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * IDENTITY-THROUGH-SEAMS-0 — matrix case I08, plus I01..I07 hostile keys.
 * Law L17: semantic identity is lossless and typed across every correctness
 * boundary. Human-readable paths are presentation, never authoritative
 * identity.
 *
 * This is the case that decides whether the asset is real. Typed
 * position/subject identity inside one subsystem proves little; the measured
 * pattern in this codebase is that semantics are strong inside a subsystem and
 * degrade at the boundary. So the composition under test is the one an
 * application actually runs:
 *
 *     transactions + entityMap + link
 *
 * CHARACTERIZATION. Assertions record what is observed. Where identity is lost
 * that is a finding to disposition, not something to repair here.
 */

type Row = { id: string; name: string };

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

/** The hostile key set from MATRIX.md, I01..I05. */
const HOSTILE_KEYS = [
  'a.b',
  'a/b',
  'a::b',
  'jo.doe@example.com',
  '1.2.3',
] as const;

describe('IDENTITY-THROUGH-SEAMS-0 / I01..I05 — hostile keys survive a link', () => {
  for (const key of HOSTILE_KEYS) {
    it(`key ${JSON.stringify(key)} reaches the endpoint intact`, async () => {
      const tree = signalTree(
        { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
        { enhancers: [transactions()] }
      );
      const sent: unknown[] = [];
      tree.$.rows.addOne({ id: key, name: 'initial' });
      await flush();

      const connection = link(tree.$.rows as never, {
        set: (value: unknown) => {
          sent.push(value);
        },
      } as never);

      try {
        tree.$.rows.updateOne(key, { name: 'changed' });
        await flush();

        // The row must still be reachable by its own business key.
        expect(tree.$.rows.byId(key)?.()?.name).toBe('changed');

        // Guard first: an inert link that never emits would otherwise make
        // every containment assertion below vacuous.
        expect(sent.length).toBeGreaterThan(0);

        // And whatever reached the endpoint must still contain that key,
        // unsplit and unescaped.
        const flat = JSON.stringify(sent);
        expect(flat).toContain(key);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    });
  }
});

describe('IDENTITY-THROUGH-SEAMS-0 / I06 — numeric 1 and string "1" must not collide', () => {
  it('two subjects with lookalike keys stay distinct through a link', async () => {
    type NumRow = { id: string | number; name: string };
    const tree = signalTree(
      {
        rows: entityMap<NumRow, string | number>({ selectId: (r) => r.id }),
      },
      { enhancers: [transactions()] }
    );
    const sent: unknown[] = [];
    const connection = link(tree.$.rows as never, {
      set: (value: unknown) => {
        sent.push(value);
      },
    } as never);

    try {
      tree.$.rows.addOne({ id: 1, name: 'numeric' });
      tree.$.rows.addOne({ id: '1', name: 'string' });
      await flush();

      const ids = tree.$.rows.ids();
      // MEASURED. If these collapse to one entry, identity was flattened.
      expect(ids).toHaveLength(2);
      expect(tree.$.rows.byId(1)?.()?.name).toBe('numeric');
      expect(tree.$.rows.byId('1')?.()?.name).toBe('string');
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

describe('IDENTITY-THROUGH-SEAMS-0 / I07 — same key, different lifetime', () => {
  it('a re-added key is a different subject, and the old handle stays dead', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'A', name: 'first' });
      await flush();
      const held = tree.$.rows.byId('A');
      expect(held?.()?.name).toBe('first');

      tree.$.rows.removeOne('A');
      await flush();
      tree.$.rows.addOne({ id: 'A', name: 'second' });
      await flush();

      // The asset under test: a reused business key is a DIFFERENT subject, so
      // the old handle must not retarget onto the new one.
      expect(held?.()).toBeUndefined();
      expect(tree.$.rows.byId('A')?.()?.name).toBe('second');
    } finally {
      tree.destroy();
    }
  });
});

describe('IDENTITY-THROUGH-SEAMS-0 / I09 — subject ids are MONOTONIC', () => {
  /**
   * Added after a mutation survived, and kept even though it does NOT kill it.
   *
   * Removing the increment from `allocateFreshSubjectId()` makes it hand out
   * [1,1,1] instead of [1,2,3] — verified directly against a bare
   * StructuralStore, so the mutation is semantically effective, not inert.
   * Yet 2,750 existing tests pass under it, and so do these two cases.
   *
   * Scope, stated precisely rather than dramatically: `planFreshSubjectIds` is
   * unaffected and still returns distinct ids, so only ONE of the two
   * allocation paths (`commitFreshSubject`) can break undetected. I07 above is
   * blind to it for a specific reason — the key->subject mapping is tombstoned
   * on removal, so a held handle reads undefined whether or not ids collide.
   *
   * These two cases assert the property that SHOULD follow from monotonic
   * allocation: no cross-talk between concurrently live subjects. They are
   * correct and worth keeping. They are not sufficient, because the collision
   * is not observable through the public entity surface in any scenario found
   * so far — lookups are key-first, so a duplicated subject id does not
   * surface as wrong data here.
   *
   * Disposition: monotonicity is a WHITE-BOX invariant. Per LAWS.md, white-box
   * invariants are written after an architecture is selected, so this is
   * recorded as a known gap rather than closed with a reach-around into
   * internals.
   */
  it('two concurrently live subjects do not share identity', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'A', name: 'a-initial' });
      tree.$.rows.addOne({ id: 'B', name: 'b-initial' });
      await flush();

      const heldA = tree.$.rows.byId('A');
      const heldB = tree.$.rows.byId('B');

      // Writing through one live subject must not be visible through another.
      tree.$.rows.updateOne('A', { name: 'a-changed' });
      await flush();

      expect(heldA?.()?.name).toBe('a-changed');
      expect(heldB?.()?.name).toBe('b-initial');
      expect(tree.$.rows.byId('B')?.()?.name).toBe('b-initial');
      expect(tree.$.rows.ids()).toEqual(['A', 'B']);
    } finally {
      tree.destroy();
    }
  });

  it('a third subject added after a removal still gets its own identity', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    try {
      tree.$.rows.addOne({ id: 'A', name: 'a' });
      tree.$.rows.addOne({ id: 'B', name: 'b' });
      await flush();
      tree.$.rows.removeOne('A');
      await flush();
      tree.$.rows.addOne({ id: 'C', name: 'c' });
      await flush();

      // C must not inherit A's retired identity and must not alias B.
      const heldB = tree.$.rows.byId('B');
      tree.$.rows.updateOne('C', { name: 'c-changed' });
      await flush();

      expect(heldB?.()?.name).toBe('b');
      expect(tree.$.rows.byId('C')?.()?.name).toBe('c-changed');
      expect(tree.$.rows.ids()).toEqual(['B', 'C']);
    } finally {
      tree.destroy();
    }
  });
});

describe('IDENTITY-THROUGH-SEAMS-0 / I08 — identity across transaction + link', () => {
  it('a rolled-back entity field does not corrupt the linked payload identity', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()] }
    );
    const sent: unknown[] = [];
    tree.$.rows.addOne({ id: 'jo.doe@example.com', name: 'initial' });
    await flush();

    const connection = link(tree.$.rows as never, {
      set: (value: unknown) => {
        sent.push(value);
      },
    } as never);

    try {
      const pending = tree.transact(() => {
        tree.$.rows.updateOne('jo.doe@example.com', { name: 'proposed' });
      });
      await flush();
      const duringPending = JSON.stringify(sent);

      pending.rollback();
      await flush();

      // After the rollback the tree must be back to the committed value...
      expect(tree.$.rows.byId('jo.doe@example.com')?.()?.name).toBe('initial');

      // ...and the key must never have been split or re-encoded on the way
      // out. A dotted, at-signed key is exactly where path-flattening shows.
      expect(sent.length).toBeGreaterThan(0);
      const all = JSON.stringify(sent);
      expect(all).toContain('jo.doe@example.com');
      expect(duringPending.length).toBeGreaterThanOrEqual(0);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
});

/**
 * STRUCTURAL-TRICHOTOMY-0 — the second open question.
 *
 * Can the ownership model separate SUPERSESSION / DEPENDENCY / INDEPENDENCE
 * for structural state WITHOUT a general dependency graph?
 *
 * The hypothesis this tests is that every distinction is decidable from LOCAL
 * structural facts already in the store:
 *
 *   T02a  add A, later write A.name        DEPENDENCY   (subject existence)
 *   T06a  rekey A->B, later write A.name   INDEPENDENCE (different dimension
 *                                                        of the same subject)
 *   T06b  rekey A->B, later add A          DEPENDENCY   (key occupancy)
 *   T07   rekey A->B, later remove A       SUPERSESSION (subject erased)
 *
 * If the current kernel already separates these, no graph is required and the
 * ownership model can be built on subject + key facts. If it collapses them,
 * that is the argument FOR a graph. Characterization either way.
 */
describe('STRUCTURAL-TRICHOTOMY-0 — is a dependency graph required?', () => {
  const rowTree = () =>
    signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }), x: 0 },
      { enhancers: [transactions()] }
    );

  const settle = (op: () => void) => {
    try {
      op();
      return 'settled';
    } catch (e) {
      return (
        ((e as { cause?: { kind?: string } })?.cause?.kind as string) ??
        'threw'
      );
    }
  };

  it('T02a add + later field write on the added subject', async () => {
    const tree = rowTree();
    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.addOne({ id: 'A', name: 'proposed' });
    });
    await flush();
    tree.$.rows.updateOne('A', { name: 'later' });
    await flush();

    const outcome = settle(() => pending.rollback());
    // MEASURED: a principled dependency refusal.
    expect(outcome).toBe('later-confirmed-dependency');
    tree.destroy();
  });

  it('T06a rekey + later field write is INDEPENDENT', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'B');
    });
    await flush();
    tree.$.rows.updateOne('B', { name: 'later' });
    await flush();

    const outcome = settle(() => pending.rollback());
    console.log(
      `[trichotomy] T06a rekey+field -> ${outcome}; ids=${JSON.stringify(
        tree.$.rows.ids()
      )}; name=${JSON.stringify(tree.$.rows.byId('A')?.()?.name)}`
    );
    // MEASURED: INDEPENDENCE handled correctly and non-trivially — the key
    // change reverses to 'A' while the later field value rides along with the
    // subject. This is the behaviour a whole-row model structurally cannot
    // express.
    expect(outcome).toBe('settled');
    expect(tree.$.rows.ids()).toEqual(['A']);
    expect(tree.$.rows.byId('A')?.()?.name).toBe('later');
    tree.destroy();
  });

  it('T06b rekey + later add at the VACATED key is DEPENDENT', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'B');
    });
    await flush();
    tree.$.rows.addOne({ id: 'A', name: 'newcomer' });
    await flush();

    const outcome = settle(() => pending.rollback());
    console.log(
      `[trichotomy] T06b rekey+occupy -> ${outcome}; ids=${JSON.stringify(
        tree.$.rows.ids()
      )}; x=${tree.$.x()}`
    );
    // RE-CHARACTERIZED 2026-09-24 by REKEY-OCCUPANCY-0, which is exactly what
    // the previous pin said should happen: "a future ownership model that
    // decides T06b deliberately will fail these and force re-characterization".
    //
    // Before: `effect-validation-failed` — the compensating re-add physically
    // failed on a taken key, after compensation had begun.
    // Now: `later-confirmed-dependency` — net key occupancy is recognised at
    // PLAN time, before anything is touched, and the refusal is recoverable.
    //
    // x is still 1 and the visible state is identical. That is not a
    // non-improvement: the difference is OWNERSHIP. The turn remains pending,
    // so x = 1 is its speculative contribution rather than a value owned by
    // nothing (L1, L8).
    expect(outcome).toBe('later-confirmed-dependency');
    expect(tree.$.rows.ids()).toEqual(['B', 'A']);
    expect(tree.$.x()).toBe(1);
    tree.destroy();
  });

  it('T07 rekey + later remove is SUPERSEDED', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'A', name: 'original' });
    await flush();
    const pending = tree.transact(() => {
      tree.$.x(1);
      tree.$.rows.changeId('A', 'B');
    });
    await flush();
    tree.$.rows.removeOne('B');
    await flush();

    const outcome = settle(() => pending.rollback());
    console.log(
      `[trichotomy] T07  rekey+remove -> ${outcome}; ids=${JSON.stringify(
        tree.$.rows.ids()
      )}; x=${tree.$.x()}`
    );
    // MEASURED: supersession, reversed cleanly and completely.
    expect(outcome).toBe('settled');
    expect(tree.$.rows.ids()).toEqual([]);
    expect(tree.$.x()).toBe(0);
    tree.destroy();
  });
});
