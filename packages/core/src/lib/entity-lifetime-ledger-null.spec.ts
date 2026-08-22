/**
 * NULL HYPOTHESIS: the retired-subject LIFETIME LEDGER is not earned.
 *
 * Zero-owner reclamation (15.0) releases a retired subject's value backing and
 * entity signal, leaving ~117 B/retired — a permanent
 * `{active:false, restoreAllowed:false}` record plus a revision entry plus two
 * Map slots — and churn is still linear in every subject that ever existed.
 *
 * The SEMANTIC that residue is believed to support is non-negotiable and is not
 * on trial here:
 *
 *     a held handle to a removed subject reads undefined forever, and a fresh
 *     entity reusing the same business key must NOT be followed by it
 *
 * What IS on trial is the claim that preserving that semantic REQUIRES the
 * ledger. The argument that it does not: stale-handle isolation is anchored in
 * SUBJECT identity, not key identity. `nextSubjectId` only ever increases and
 * `tombstoneSubject` already deletes the key -> subject mapping, so a re-add of
 * the same key is a different subject by construction. The held signal survives
 * because the CONSUMER holds it, and nothing can write to it once the map entry
 * is gone.
 *
 * Every row below runs in BOTH arms via `describe.each`. A row that only passes
 * with the ledger present is the ledger earning itself; a row that passes in
 * both is a row the ledger was not buying.
 *
 * ⚠️ GC-DEPENDENT PROPERTIES ARE NOT HERE. "Still reads undefined after
 * collection pressure" is only observable across a real GC, which vitest cannot
 * force. `tools/check-signal-identity-durability.mjs` owns that, and it runs
 * both arms too.
 *
 * See docs/architecture/retired-subject-churn.md, open question 2.
 */
import { entityMap } from './markers/entity-map';
import { setForgetRetiredSubjectLifetimeForTrial } from './entity-signal';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/time-travel/time-travel';
import { transactions } from '../enhancers/transactions/transactions';

type Row = { id: string; name: string };

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeRows = () => {
  const tree = signalTree({
    rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  });
  return tree.$.rows;
};

const ARMS: Array<[string, boolean]> = [
  ['ledger KEPT (shipped)', false],
  ['ledger FORGOTTEN (null)', true],
];

describe.each(ARMS)('zero-owner retirement — %s', (_label, forget) => {
  beforeEach(() => setForgetRetiredSubjectLifetimeForTrial(forget));
  afterEach(() => setForgetRetiredSubjectLifetimeForTrial(false));

  it('GATE 2 — a fresh entity reusing the key is not followed by a stale handle', () => {
    const rows = makeRows();
    rows.setAll([{ id: 'A', name: 'Alpha' }]);

    const held = rows.byId('A');
    expect(held?.()?.name).toBe('Alpha');

    rows.removeOne('A');
    expect(held?.()).toBeUndefined();

    rows.addOne({ id: 'A', name: 'Second' });

    // The live lookup sees the new subject...
    expect(rows.byId('A')?.().name).toBe('Second');
    // ...and the stale handle does not.
    expect(held?.()).toBeUndefined();
  });

  it('GATE 2b — a held FIELD reference behaves the same', () => {
    const rows = makeRows();
    rows.setAll([{ id: 'A', name: 'Alpha' }]);

    const field = (rows.byId('A') as unknown as { name: () => string }).name;
    expect(field()).toBe('Alpha');

    rows.removeOne('A');
    rows.addOne({ id: 'A', name: 'Second' });

    expect(field()).toBeUndefined();
    expect(rows.byId('A')?.name()).toBe('Second');
  });

  it('GATE 3 — independent stale handles stay isolated from each other', () => {
    const rows = makeRows();
    rows.setAll([
      { id: 'A', name: 'A1' },
      { id: 'B', name: 'B1' },
    ]);

    const heldA = rows.byId('A');
    const heldB = rows.byId('B');

    rows.removeOne('A');
    expect(heldA?.()).toBeUndefined();
    // Retiring A must not disturb B.
    expect(heldB?.()?.name).toBe('B1');

    rows.removeOne('B');
    expect(heldB?.()).toBeUndefined();

    // Two generations of re-adds; neither stale handle follows either.
    rows.addOne({ id: 'A', name: 'A2' });
    rows.addOne({ id: 'B', name: 'B2' });
    const heldA2 = rows.byId('A');

    expect(heldA?.()).toBeUndefined();
    expect(heldB?.()).toBeUndefined();
    expect(heldA2?.().name).toBe('A2');
    expect(heldA2).not.toBe(heldA);
  });

  it('GATE 3b — subject ids are never recycled, which is what anchors the above', () => {
    const rows = makeRows() as unknown as {
      setAll(r: Row[]): void;
      addOne(r: Row): void;
      removeOne(id: string): void;
      __acquireEntityHandleForTesting(id: string): { subjectId: number };
    };
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const first = rows.__acquireEntityHandleForTesting('A').subjectId;

    rows.removeOne('A');
    rows.addOne({ id: 'A', name: 'Second' });
    const second = rows.__acquireEntityHandleForTesting('A').subjectId;

    expect(second).not.toBe(first);
    expect(second).toBeGreaterThan(first);
  });

  it('GATE 5 — a tree WITH a restorer is untouched by the trial flag', async () => {
    // The flag gates a zero-owner path; a tree with restoration authority must
    // not reach it at all, in either arm.
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      {
        enhancers: [timeTravel({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      }
    );
    tree.$.rows.setAll([
      { id: 'A', name: 'Alpha' },
      { id: 'B', name: 'Beta' },
    ]);
    await tick();

    const held = tree.$.rows.byId('A');
    tree.$.rows.removeOne('A');
    await tick();
    expect(held?.()).toBeUndefined();

    tree.undo();
    await tick();

    expect(tree.$.rows.byId('A')?.().name).toBe('Alpha');
    // And the held reference re-publishes: same subject, restored.
    expect(held?.()?.name).toBe('Alpha');
  });

  it('GATE 5b — transactions rollback is untouched by the trial flag', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()], capabilities: ['causal-runtime'] }
    );
    // Seeded with addOne and settled over two microtasks, matching the shape
    // transactions.spec.ts uses. A `setAll` seed lands in the same turn the
    // transaction opens on and the rollback then reverts the seed too — worth
    // knowing, but not what this row is about.
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    tree.$.rows.addOne({ id: 'B', name: 'Beta' });
    await Promise.resolve();
    await Promise.resolve();

    // A retirement OUTSIDE the transaction, so the flag's code path is
    // exercised on a tree that also has a restorer — which must keep it off.
    tree.$.rows.removeOne('B');
    await Promise.resolve();
    await Promise.resolve();

    const pending = (
      tree as unknown as {
        transaction: (f: () => void) => { rollback(): void };
      }
    ).transaction(() => {
      tree.$.rows.updateOne('A', { name: 'Changed' });
    });
    expect(tree.$.rows.byId('A')?.().name).toBe('Changed');

    pending.rollback();
    await Promise.resolve();
    await Promise.resolve();

    // ⚠️ ASSERTS A DEFECT, DELIBERATELY. Rolling back an entity field update
    // writes the FIELD's previous value into the ENTITY slot, so the row becomes
    // the bare string 'Alpha' instead of { id: 'A', name: 'Alpha' }. That is
    // wrong, it predates this branch entirely (reproduced at 0a23a551), and it
    // is pinned in `transactions-documented-defects.spec.ts`.
    //
    // It is asserted here rather than worked around because this row's job is
    // "the trial flag changes nothing about transactions". Asserting the correct
    // value would make the row fail for a reason that has nothing to do with the
    // trial; asserting the actual value keeps it able to detect a change.
    expect(tree.$.rows.byId('A')?.() as unknown).toBe('Alpha');
    // Membership is restored correctly, and B — retired outside the transaction
    // — is not resurrected.
    expect(tree.$.rows.ids()).toEqual(['A']);
  });
});

/**
 * GATE 4 — what the ledger's absence actually costs, stated rather than assumed.
 *
 * These rows are DIFFERENT between the arms on purpose. They are the price of
 * the null, and the trial is only decidable if the price is written down.
 */
describe('zero-owner retirement — what forgetting gives up', () => {
  afterEach(() => setForgetRetiredSubjectLifetimeForTrial(false));

  const inspectHandle = (rows: unknown, id: string) => {
    const r = rows as {
      __acquireEntityHandleForTesting(k: string): unknown;
      __resolveEntityHandleForTesting(h: unknown): { state: string };
    };
    return r.__acquireEntityHandleForTesting(id);
  };

  it('KEPT: a stale handle resolves as `tombstoned`', () => {
    setForgetRetiredSubjectLifetimeForTrial(false);
    const rows = makeRows();
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const handle = inspectHandle(rows, 'A');
    rows.removeOne('A');

    const resolved = (
      rows as unknown as {
        __resolveEntityHandleForTesting(h: unknown): { state: string };
      }
    ).__resolveEntityHandleForTesting(handle);
    expect(resolved.state).toBe('tombstoned');
  });

  it('FORGOTTEN: the same handle resolves as `missing` instead', () => {
    // This is the ONLY behavioural difference the gates found. It collapses
    // "this subject retired" into "this handle is unrecognised", and
    // `resolveSubjectHandle` already returns `missing` for a handle from a
    // previous collection incarnation — so the two become indistinguishable.
    //
    // Reachable ONLY through `__resolveEntityHandleForTesting`. There is no
    // production consumer of handle resolution: `entity-handle-resolution.ts` is
    // imported by exactly one call site, and that call site is the `__`-prefixed
    // testing hook.
    setForgetRetiredSubjectLifetimeForTrial(true);
    const rows = makeRows();
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const handle = inspectHandle(rows, 'A');
    rows.removeOne('A');

    const resolved = (
      rows as unknown as {
        __resolveEntityHandleForTesting(h: unknown): { state: string };
      }
    ).__resolveEntityHandleForTesting(handle);
    expect(resolved.state).toBe('missing');
  });

  it('FORGOTTEN: the retired subject stops being a reclamation candidate', () => {
    // Correct rather than lossy — it has nothing left to reclaim — but it means
    // `__listSubjectReclamationCandidates` can no longer be used to enumerate
    // history. Nothing in production enumerates it.
    setForgetRetiredSubjectLifetimeForTrial(true);
    const rows = makeRows() as unknown as {
      setAll(r: Row[]): void;
      removeOne(id: string): void;
      __listSubjectReclamationCandidates(): readonly number[];
    };
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    rows.removeOne('A');

    expect(rows.__listSubjectReclamationCandidates()).toEqual([]);
  });
});
