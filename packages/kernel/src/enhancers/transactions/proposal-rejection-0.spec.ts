import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { transactions } from './transactions';

/**
 * PROPOSAL-REJECTION-0 — OBSERVATION PASS. Preregistered in TODO.md.
 *
 * > NULL: current rejection semantics are correct as general transaction
 * > behaviour, and a truthful multi-writer review UX can be built on them with
 * > no proposal-specific rule.
 *
 * THIS FILE FIXES NOTHING AND DISPOSITIONS NOTHING. Every expectation records
 * what HEAD does today. An expectation here means "this is what happens",
 * never "this is what should happen". The PR-A / PR-B / PR-C disposition is
 * argued in TODO.md against these measurements, not asserted here.
 *
 * ---------------------------------------------------------------------------
 * MEASURED, 2026-09-22:
 *
 *   later effect vs the pending turn            rejection behaviour
 *   ------------------------------------------------------------------------
 *   scalar set, later REPLACEMENT of the         surgical compensation —
 *   same location (authored or realized)         the replaced location keeps
 *                                                the newer value, every other
 *                                                location in the turn is
 *                                                compensated, no refusal
 *
 *   structural add, later UPDATE of the          whole-turn refusal —
 *   added subject                                nothing compensated, every
 *                                                location in the turn stays at
 *                                                its proposed value
 *
 *   structural add, later REMOVE of the          whole-turn refusal —
 *   added subject (authored or realized)         same as above, although the
 *                                                turn's structural fact is
 *                                                already gone
 * ---------------------------------------------------------------------------
 *
 * The third row is the discriminating control: it separates "newer truth
 * DEPENDS on the speculative structure" from "newer truth SUPERSEDED it".
 * `classifyLaterOverlap` draws that distinction for scalars via
 * `mutationIntent === 'replace'` + `supersededScalarKeys`.
 * `hasSameSubjectDependency` returns a conflict for ANY later same-subject
 * effect. Both facts are stated here as read code; what they imply is a
 * disposition question and lives in TODO.md.
 *
 * Deliberately NOT done here, per the preregistration: no propose()/accept()/
 * reject() naming, no change to transaction semantics, nothing touching
 * MO-1A, MO-1B or MO-3A.
 *
 * On settlement/disposition: commit-vs-discard is NOT observable from outside
 * the kernel — that is MO-2, still open. The external proxy is the pending
 * turn count, so that is what is recorded, and the gap is reported rather than
 * papered over.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

/** A server/outside write: participation 'realized', not authored locally. */
const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

/** `false` when the reject was accepted, otherwise the refusal kind. */
const tryReject = (pending: { rollback(): void }): false | unknown => {
  try {
    pending.rollback();
    return false;
  } catch (error) {
    return (error as { cause?: { kind?: unknown } })?.cause?.kind ?? 'error';
  }
};

const pendingCount = (tree: unknown): number =>
  (
    tree as { __transactions: { getPendingTurnCount(): number } }
  ).__transactions.getPendingTurnCount();

type Scalars = { a: number; b: number; c: number; unrelated: number };

const scalarTree = () =>
  signalTree(
    { a: 0, b: 0, c: 0, unrelated: 0 },
    { enhancers: [transactions()] }
  ) as unknown as {
    $: {
      (): Scalars;
      a: (v?: number) => number;
      b: (v?: number) => number;
      c: (v?: number) => number;
      unrelated: (v?: number) => number;
    };
    transaction: (fn: () => void) => { confirm(): void; rollback(): void };
  };

const rowTree = () =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      x: 0,
      y: 0,
    },
    { enhancers: [transactions()] }
  );

// ───────────────────────────── scalar later effects ─────────────────────────

describe('PROPOSAL-REJECTION-0 / 1 — clean reject, no competing writer', () => {
  it('OK: reverts the proposed value, does not refuse', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
    });
    await flush();

    expect(tree.$.a()).toBe(1); // speculative value IS visible pre-reject
    expect(pendingCount(tree)).toBe(1);

    expect(tryReject(pending)).toBe(false);
    expect(tree.$.a()).toBe(0);
    expect(pendingCount(tree)).toBe(0);
  });
});

describe('PROPOSAL-REJECTION-0 / 2 — same-location EXTERNAL realization', () => {
  it('OK: surgical — preserves the newer external value, no refusal', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
      tree.$.b(2);
    });
    await flush();

    realization(() => tree.$.a(99));
    await flush();

    expect({ a: tree.$.a(), b: tree.$.b() }).toEqual({ a: 99, b: 2 });
    expect(tryReject(pending)).toBe(false);

    // `a` keeps the server's value; `b` is compensated.
    expect({ a: tree.$.a(), b: tree.$.b() }).toEqual({ a: 99, b: 0 });
  });
});

describe('PROPOSAL-REJECTION-0 / 3 — same-location AUTHORED write', () => {
  it('OK: an ordinary later local write is treated the same as a realization', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
      tree.$.b(2);
    });
    await flush();

    tree.$.a(50); // ordinary authored write: no transaction, no realization
    await flush();

    expect(tryReject(pending)).toBe(false);
    expect({ a: tree.$.a(), b: tree.$.b() }).toEqual({ a: 50, b: 0 });
  });
});

describe('PROPOSAL-REJECTION-0 / 4 — multi-location, ONE conflicting location', () => {
  it('OK: compensates the two untouched locations, keeps the conflicting one', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
      tree.$.b(2);
      tree.$.c(3);
    });
    await flush();

    realization(() => tree.$.a(99));
    await flush();

    expect(tryReject(pending)).toBe(false);
    expect({ a: tree.$.a(), b: tree.$.b(), c: tree.$.c() }).toEqual({
      a: 99,
      b: 0,
      c: 0,
    });
  });
});

describe('PROPOSAL-REJECTION-0 / 5 — multi-location, MULTIPLE conflicting', () => {
  it('OK: every conflicting location is handled, not just the first', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
      tree.$.b(2);
      tree.$.c(3);
    });
    await flush();

    realization(() => {
      tree.$.a(97);
      tree.$.b(98);
    });
    await flush();

    expect(tryReject(pending)).toBe(false);
    // Both replaced locations keep their newer values; the untouched one is
    // compensated. No conflict is reported on this arm.
    expect({ a: tree.$.a(), b: tree.$.b(), c: tree.$.c() }).toEqual({
      a: 97,
      b: 98,
      c: 0,
    });
  });
});

describe('PROPOSAL-REJECTION-0 / 6 — coalesced same-location writes', () => {
  it('OK: MO-1B coalescing rejects cleanly to the pre-turn value', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
      tree.$.a(2); // coalesces to the net effect, by design
    });
    await flush();

    expect(tree.$.a()).toBe(2);
    expect(tryReject(pending)).toBe(false);
    expect(tree.$.a()).toBe(0);
  });
});

// ─────────────────────────── structural later effects ───────────────────────

describe('PROPOSAL-REJECTION-0 / 7 — structural remove + re-add, no competitor', () => {
  it('OK: restores the original row', async () => {
    const tree = rowTree();
    tree.$.rows.addOne({ id: 'a', name: 'Original' });
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.removeOne('a');
      tree.$.rows.addOne({ id: 'a', name: 'Reproposed' });
    });
    await flush();

    expect(tree.$.rows.byId('a')?.()?.name).toBe('Reproposed');
    expect(tryReject(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('Original');
  });
});

describe('PROPOSAL-REJECTION-0 / 8 — structural add, no competitor (control)', () => {
  it('OK: removes the proposed row', async () => {
    const tree = rowTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.rows.addOne({ id: 'a', name: 'Proposed' });
    });
    await flush();

    expect(tryReject(pending)).toBe(false);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('PROPOSAL-REJECTION-0 / 9 — MIXED proposal, server touches the row', () => {
  it('refuses the whole turn; untouched scalars stay at proposed values', async () => {
    const tree = rowTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.x(1);
      tree.$.y(2);
      tree.$.rows.addOne({ id: 'a', name: 'Proposed' });
    });
    await flush();

    realization(() => tree.$.rows.updateOne('a', { name: 'FromServer' }));
    await flush();

    expect(tryReject(pending)).toBe('later-confirmed-dependency');

    // Nothing ever wrote to x or y, yet after the rejection they hold the
    // values the rejected turn proposed. Compensated locations: none.
    expect(tree.$.x()).toBe(1);
    expect(tree.$.y()).toBe(2);
    expect(tree.$.rows.ids()).toEqual(['a']);
    expect(tree.$.rows.byId('a')?.()?.name).toBe('FromServer');
  });
});

describe('PROPOSAL-REJECTION-0 / 10 — unrelated writer must NOT block (control)', () => {
  it('OK: a realization elsewhere leaves the reject legal', async () => {
    const tree = scalarTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.a(1);
    });
    await flush();

    realization(() => tree.$.unrelated(42));
    await flush();

    // If this refused, the conflict criterion would be over-broad and every
    // observation above would be uninterpretable.
    expect(tryReject(pending)).toBe(false);
    expect({ a: tree.$.a(), unrelated: tree.$.unrelated() }).toEqual({
      a: 0,
      unrelated: 42,
    });
  });
});

// ───────────────── the discriminating control: supersession ──────────────────
//
// Dependency and supersession are separated here. In cases 11 and 12 the later
// writer REMOVES the subject the pending turn added, so the turn's structural
// contribution is already gone and no newer truth rests on it continuing to
// exist. Compensating the turn's other locations would complete the reversal
// rather than half-apply it. What HEAD does in that situation is recorded, not
// judged.

describe('PROPOSAL-REJECTION-0 / 11 — structural supersession, REALIZED remove', () => {
  it('refuses although the added subject is already gone', async () => {
    const tree = rowTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.x(1);
      tree.$.y(2);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    realization(() => tree.$.rows.removeOne('A'));
    await flush();

    // The turn's structural fact no longer exists before the reject is asked
    // for; nothing later depends on it.
    expect(tree.$.rows.ids()).toEqual([]);

    expect(tryReject(pending)).toBe('later-confirmed-dependency');
    expect(tree.$.x()).toBe(1);
    expect(tree.$.y()).toBe(2);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});

describe('PROPOSAL-REJECTION-0 / 12 — structural supersession, AUTHORED remove', () => {
  it('refuses identically, so the behaviour is not realization-specific', async () => {
    const tree = rowTree();
    await flush();

    const pending = tree.transaction(() => {
      tree.$.x(1);
      tree.$.y(2);
      tree.$.rows.addOne({ id: 'A', name: 'Proposed' });
    });
    await flush();

    tree.$.rows.removeOne('A');
    await flush();

    expect(tryReject(pending)).toBe('later-confirmed-dependency');
    expect(tree.$.x()).toBe(1);
    expect(tree.$.y()).toBe(2);
    expect(tree.$.rows.ids()).toEqual([]);
  });
});
