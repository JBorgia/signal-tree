/**
 * ZERO-OWNER RETIREMENT FORGETS THE WHOLE SUBJECT — and isolation survives it.
 *
 * A retirement on a tree with no restoration authority releases the value
 * backing, the entity signal, the subject lifetime record AND the revision
 * entry. Nothing per-subject is kept.
 *
 * ## The semantic this must never cost, which is why the file exists
 *
 *     held handle -> removed subject -> undefined, forever
 *     a fresh entity reusing the same business key must NOT be followed by it
 *
 * That is non-negotiable and was never on trial. What WAS on trial is the claim
 * that preserving it requires a permanent `{active:false, restoreAllowed:false}`
 * record plus a revision entry for every subject that ever existed — 117 B each,
 * growing without bound. It does not, and these rows are the falsification.
 *
 * ## Why isolation survives with nothing retained
 *
 * It is anchored in SUBJECT identity, not key identity. `nextSubjectId` only
 * ever increases and `tombstoneSubject` already deletes the key -> subject
 * mapping, so a re-add of the same key is a DIFFERENT subject by construction —
 * no ledger consulted. The stale handle keeps reading `undefined` because the
 * consumer holds the orphaned signal and, with the map entry deleted, nothing
 * can write to it again.
 *
 * ⚠️ THE GC-DEPENDENT HALF IS NOT HERE. "Still undefined after collection
 * pressure" is not observable without a real GC, which vitest cannot force.
 * `tools/check-signal-identity-durability.mjs` owns those four properties and is
 * a release gate. Do not read this file as complete coverage of the claim.
 *
 * See docs/architecture/retired-subject-churn.md, "TRIAL".
 */
import { entityMap } from './markers/entity-map';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/time-travel/time-travel';
import { transactions } from '../enhancers/transactions/transactions';

type Row = { id: string; name: string };

const makeRows = () => {
  const tree = signalTree({
    rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  });
  return tree.$.rows;
};

describe('zero-owner retirement — isolation without a lifetime ledger', () => {
  it('a fresh entity reusing the key is not followed by a stale handle', () => {
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

  it('a held FIELD reference behaves the same', () => {
    const rows = makeRows();
    rows.setAll([{ id: 'A', name: 'Alpha' }]);

    const field = (rows.byId('A') as unknown as { name: () => string }).name;
    expect(field()).toBe('Alpha');

    rows.removeOne('A');
    rows.addOne({ id: 'A', name: 'Second' });

    expect(field()).toBeUndefined();
    expect(rows.byId('A')?.name()).toBe('Second');
  });

  it('independent stale handles stay isolated from each other', () => {
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

    rows.addOne({ id: 'A', name: 'A2' });
    rows.addOne({ id: 'B', name: 'B2' });
    const heldA2 = rows.byId('A');

    expect(heldA?.()).toBeUndefined();
    expect(heldB?.()).toBeUndefined();
    expect(heldA2?.().name).toBe('A2');
    expect(heldA2).not.toBe(heldA);
  });

  it('SUBJECT IDS ARE NEVER RECYCLED — which is what anchors all of the above', () => {
    // If this ever stops holding, every row in this file goes with it: a reused
    // subject id would let a stale handle address a live entity. It is asserted
    // directly so the dependency is visible rather than implied.
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
});

describe('a tree WITH a restorer keeps everything', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('timeTravel undo still restores a removed row', async () => {
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
    // The held reference re-publishes: same subject, restored.
    expect(held?.()?.name).toBe('Alpha');
  });

  it('transactions rollback is unaffected by retirements outside it', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [transactions()], capabilities: ['causal-runtime'] }
    );
    tree.$.rows.addOne({ id: 'A', name: 'Alpha' });
    tree.$.rows.addOne({ id: 'B', name: 'Beta' });
    await Promise.resolve();
    await Promise.resolve();

    // A retirement OUTSIDE the transaction, on a tree that HAS a restorer — so
    // the forget path must stay switched off for it.
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

    // This row asserted the broken value until the entity field rollback defect
    // was fixed — see `transactions-entity-field-rollback.spec.ts`, which owns
    // that behaviour. Here it is only a control: retirement must not disturb
    // transactions.
    expect(tree.$.rows.byId('A')?.()).toEqual({ id: 'A', name: 'Alpha' });
    // Membership is restored, and B is not resurrected by the rollback.
    expect(tree.$.rows.ids()).toEqual(['A']);
  });
});

/**
 * THE PRICE, stated rather than assumed.
 *
 * Two internal surfaces change. Both are pinned so a future reader can see what
 * forgetting actually cost, instead of rediscovering it.
 */
describe('what forgetting the ledger gives up', () => {
  it('a stale handle resolves as `missing`, no longer as `tombstoned`', () => {
    // This collapses "this subject retired" into "this handle is unrecognised" —
    // `resolveSubjectHandle` already returns `missing` for a handle from a
    // previous collection incarnation, so the two become indistinguishable.
    //
    // Acceptable because there is no production consumer: handle resolution has
    // exactly one call site (`entity-handle-resolution.ts`) and it is the
    // `__`-prefixed testing hook below.
    const rows = makeRows() as unknown as {
      setAll(r: Row[]): void;
      removeOne(id: string): void;
      __acquireEntityHandleForTesting(k: string): unknown;
      __resolveEntityHandleForTesting(h: unknown): { state: string };
    };
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const handle = rows.__acquireEntityHandleForTesting('A');
    rows.removeOne('A');

    expect(rows.__resolveEntityHandleForTesting(handle).state).toBe('missing');
  });

  it('the retired subject stops being a reclamation candidate', () => {
    // Correct rather than lossy — it has nothing left to reclaim — but it means
    // `__listSubjectReclamationCandidates` can no longer be used to enumerate
    // retirement history. Nothing in production enumerates it.
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

/**
 * REGRESSION ROWS FOR THE TWO WAYS THIS QUIETLY UNDOES ITSELF.
 *
 * Both were found the hard way and neither is visible in a memory total until
 * it is large enough to notice, which is exactly why they are asserted directly.
 */
describe('a forgotten lifetime stays forgotten', () => {
  const internals = (rows: unknown) =>
    rows as unknown as {
      setAll(r: Row[]): void;
      addOne(r: Row): void;
      removeOne(id: string): void;
      updateOne(id: string, patch: Partial<Row>): void;
      byId(id: string): (() => Row | undefined) | undefined;
      ids(): string[];
      __acquireEntityHandleForTesting(k: string): { subjectId: number };
      __inspectSubjectResources(id: number): unknown;
      __resolveEntityHandleForTesting(h: unknown): { state: string };
      __listSubjectReclamationCandidates(): readonly number[];
    };

  it('THE 79 B BUG — nothing re-interns the subject before the operation ends', () => {
    // `publishSubjectPhysicalChange` -> `bumpSubjectRevision` does
    // `subjectRevisions.set(id, revision + 1)`, which RESURRECTS an entry the
    // forget just deleted. It ran after the commit inside the very same
    // retirement, so the subject was deleted and immediately recreated and the
    // measurement read 79 B/retired instead of 6 B — a two-thirds-implemented
    // null that looked like a legitimate partial result.
    //
    // Asserted at the END of the whole retirement operation, not mid-way, since
    // that is where the resurrection happened. Any future step appended to the
    // retirement path that touches the subject by id fails here.
    const rows = internals(makeRows());
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const handle = rows.__acquireEntityHandleForTesting('A');

    rows.removeOne('A');

    // No lifetime record, and no revision entry regrown behind it: a revision
    // that had been re-interned would resolve the handle with a `revision`
    // field instead of reporting it unrecognised.
    expect(rows.__inspectSubjectResources(handle.subjectId)).toBeUndefined();
    expect(rows.__resolveEntityHandleForTesting(handle)).toEqual({
      state: 'missing',
      subjectId: handle.subjectId,
      acquiredRevision: 0,
    });
    expect(rows.__listSubjectReclamationCandidates()).toEqual([]);
  });

  it('stays forgotten across further unrelated churn', () => {
    // A later mutation must not resurrect an earlier retirement by touching
    // shared bookkeeping — the same failure mode, one operation removed.
    const rows = internals(makeRows());
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const handle = rows.__acquireEntityHandleForTesting('A');
    rows.removeOne('A');

    rows.addOne({ id: 'B', name: 'Beta' });
    rows.updateOne('B', { name: 'Beta2' });
    rows.addOne({ id: 'A', name: 'Second' });
    rows.removeOne('B');
    rows.setAll([{ id: 'C', name: 'Gamma' }]);

    expect(rows.__inspectSubjectResources(handle.subjectId)).toBeUndefined();
    expect(rows.__listSubjectReclamationCandidates()).toEqual([]);
  });

  it("planRestore's retired-backing guard is UNREACHABLE, not unenforced", () => {
    // THE ASSUMPTION THIS CHANGE RESTS ON, encoded rather than left as tribal
    // knowledge.
    //
    // `planRestore` refuses a subject whose backing was retired:
    //
    //     const state = resolveSubjectState(subjectId);
    //     if (state && !state.restoreAllowed) throw ...
    //
    // Forgetting deletes that state, so `state` is undefined and the guard
    // PASSES for a forgotten subject. Both halves are asserted below, because
    // the safety argument is not "the guard still fires" — it is "nothing can
    // reach the guard".
    const rows = makeRows() as unknown as {
      setAll(r: Row[]): void;
      removeOne(id: string): void;
      __acquireEntityHandleForTesting(k: string): { subjectId: number };
      __planRestore(
        key: string,
        entity: Row,
        subjectId: number
      ): { commit(): void; publish(): void };
    };
    rows.setAll([{ id: 'A', name: 'Alpha' }]);
    const subjectId = rows.__acquireEntityHandleForTesting('A').subjectId;
    rows.removeOne('A');

    // HALF ONE: the guard no longer fires. Reached only by calling the
    // non-enumerable internal directly, which is what makes this a statement
    // about reachability rather than a defect.
    expect(() =>
      rows.__planRestore('A', { id: 'A', name: 'Alpha' }, subjectId)
    ).not.toThrow();

    // HALF TWO: no public path leads there. A tree with no restoration
    // authority exposes no restoration surface, and `__planRestore` is consumed
    // only by the causal-runtime adapter that `timeTravel()`/`transactions()`
    // install. If any of these ever appears on a bare tree, forgetting must
    // stop — the guard would then be genuinely unenforced rather than
    // unreachable.
    const bare = signalTree({
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
    }) as unknown as Record<string, unknown>;
    for (const surface of ['undo', 'redo', 'jumpTo', 'transaction', 'getHistory']) {
      expect(bare[surface]).toBeUndefined();
    }
  });
});
