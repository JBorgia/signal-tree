import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './diagnostic-journal';
import { entityMap } from '../../markers/entity-map';
import { getSubjectRestorationClaims } from '../subject-restoration-claims';
import { restoration } from '../../../enhancers/restoration/restoration';
import { signalTree } from '../../signal-tree';
import { transactions } from '../../../enhancers/transactions/transactions';
import { undoable } from '../../undoable';

/**
 * DIAG-JOURNAL-1 · F3, F4, F4b, F5 — observation must not become ownership.
 *
 * Every case runs the SAME sequence twice, once with the journal installed and
 * once without, and compares the ownership facts SignalTree already tracks.
 * The falsifier is not "the number did not change" — it is that installing an
 * observer cannot make a turn restorable, keep it restorable longer, give it a
 * new restoration owner, or change what gets reclaimed.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Rows = {
  addOne(row: Row): void;
  removeOne(id: string): void;
  ids(): string[];
  __acquireEntityHandleForTesting?: (
    id: string
  ) => { subjectId: number } | undefined;
  __listSubjectReclamationCandidates?: () => readonly number[];
};

type Store = {
  $: { rows: Rows; n: { (): number; set(v: number): void } };
  getRestorationHistory(): unknown[];
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  transaction(fn: () => void): { confirm(): void; rollback(): void };
};

const makeTree = (maxHistorySize = 50) =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }), n: 0 },
    { enhancers: [restoration({ maxHistorySize }), transactions()] }
  ) as unknown as Store;

const retired = (rows: Rows): readonly number[] =>
  [...(rows.__listSubjectReclamationCandidates?.() ?? [])].sort();

/** Run `body` against a fresh tree, with or without an observer installed. */
const run = async <R>(
  withJournal: boolean,
  body: (tree: Store) => Promise<R> | R,
  maxHistorySize = 50
): Promise<R> => {
  const tree = makeTree(maxHistorySize);
  await flush();
  const journal = withJournal
    ? createDiagnosticJournal(tree as unknown as object, { maxTurns: 100 })
    : undefined;
  try {
    return await body(tree);
  } finally {
    journal?.dispose();
  }
};

/**
 * ⚠️ POSITIVE CONTROL, and the reason it exists.
 *
 * "OFF equals ON" is vacuously true for a journal that observed NOTHING — and a
 * silently-inert observer is exactly the defect TURN-FEED-0.2 just found one
 * layer down. So every ON arm below also proves the journal actually recorded
 * the occurrence whose ownership is being compared. An equality result is only
 * evidence if the observer could have been the thing that broke it.
 */
const runObserved = async <R>(
  body: (tree: Store) => Promise<R> | R,
  maxHistorySize = 50
): Promise<{ result: R; observed: ReturnType<
  ReturnType<typeof createDiagnosticJournal>['turns']
> }> => {
  const tree = makeTree(maxHistorySize);
  await flush();
  const journal = createDiagnosticJournal(tree as unknown as object, {
    maxTurns: 100,
  });
  const result = await body(tree);
  const observed = journal.turns().map((t) => ({ ...t }));
  journal.dispose();
  return { result, observed };
};

const observedPaths = (
  turns: readonly { effects: readonly { path: string }[] }[]
): string[] => turns.flatMap((t) => t.effects.map((e) => e.path));

describe('DIAG-JOURNAL-1 F3: the journal grants zero restoration rights', () => {
  const sequence = async (tree: Store) => {
    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    tree.$.n.set(9); // undesignated: must stay unadmitted, watched or not
    await flush();
    undoable(() => tree.$.rows.addOne({ id: 'b', name: 'Beta' }));
    await flush();
    tree.undo();
    await flush();

    const claims = getSubjectRestorationClaims(tree as unknown as object);
    return {
      history: tree.getRestorationHistory().length,
      canUndo: tree.canUndo(),
      canRedo: tree.canRedo(),
      ids: [...tree.$.rows.ids()].sort(),
      retired: retired(tree.$.rows),
      claimedRetired: retired(tree.$.rows).filter((s) => claims?.isClaimed(s)),
    };
  };

  it('every restoration fact is identical with the journal ON', async () => {
    const off = await run(false, sequence);
    const { result: on, observed } = await runObserved(sequence);
    expect(on).toEqual(off);

    // CONTROL: the journal saw the writes whose restoration facts were compared.
    expect(observed.length).toBeGreaterThan(0);
    expect(observedPaths(observed).some((p) => p.startsWith('rows'))).toBe(true);
    expect(observedPaths(observed)).toContain('n');
  });

  it('the journal exposes no restoration or planning operation', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);
    undoable(() => tree.$.n.set(1));
    await flush();

    // A read-only projection has exactly three members, all read or teardown.
    expect(Object.keys(journal).sort()).toEqual([
      'dispose',
      'transactionEvents',
      'turns',
    ]);
    for (const forbidden of [
      'undo',
      'redo',
      'jumpTo',
      'restore',
      'apply',
      'applyState',
      'claim',
      'retain',
      'release',
      'plan',
      'rollback',
      'settle',
    ]) {
      expect((journal as unknown as Record<string, unknown>)[forbidden]).toBe(
        undefined
      );
    }
    journal.dispose();
  });
});

describe('DIAG-JOURNAL-1 F4: the journal acquires no SignalTree ownership', () => {
  const sequence = async (tree: Store) => {
    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    const subject = tree.$.rows.__acquireEntityHandleForTesting?.('a')
      ?.subjectId as number;
    undoable(() => tree.$.rows.removeOne('a'));
    await flush();

    const pending = tree.transaction(() =>
      tree.$.rows.addOne({ id: 'b', name: 'Beta' })
    );
    await flush();
    pending.rollback();
    await flush();

    const claims = getSubjectRestorationClaims(tree as unknown as object);
    return {
      subjectClaimed: claims?.isClaimed(subject),
      claimOwners: [...(claims?.ownersOf(subject) ?? [])].sort(),
      retired: retired(tree.$.rows),
      ids: [...tree.$.rows.ids()].sort(),
    };
  };

  it('claims, claim OWNERS and reclamation candidates are unchanged', async () => {
    const off = await run(false, sequence);
    const { result: on, observed } = await runObserved(sequence);

    // Owners, not just counts: the falsifier is a NEW restoration owner
    // appearing because something started watching.
    expect(on).toEqual(off);

    // CONTROL: the journal observed the transaction it is accused of owning.
    expect(
      observed.some((t) =>
        t.effects.some((e) => typeof e.transactionId === 'number')
      )
    ).toBe(true);
  });
});

describe('DIAG-JOURNAL-1 F5: reclamation disposition is identical', () => {
  const WINDOW = 3;

  const sequence = async (tree: Store) => {
    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    await flush();
    const subject = tree.$.rows.__acquireEntityHandleForTesting?.('a')
      ?.subjectId as number;

    undoable(() => tree.$.rows.removeOne('a'));
    await flush();
    await flush();

    const claims = getSubjectRestorationClaims(tree as unknown as object);
    const claimedWhileRestorable = claims?.isClaimed(subject);

    // Push the removal out of the retention window: the last legal reason to
    // keep the subject disappears.
    for (let i = 0; i < WINDOW * 3; i++) {
      undoable(() => tree.$.rows.addOne({ id: `f-${i}`, name: 'f' }));
      await flush();
      await flush();
    }

    return {
      claimedWhileRestorable,
      claimedAfterEviction: claims?.isClaimed(subject),
      stillRetired: retired(tree.$.rows).includes(subject),
    };
  };

  it('a subject whose only remaining reason to exist is the journal is STILL reclaimed', async () => {
    const off = await run(false, sequence, WINDOW);
    const { result: on, observed } = await runObserved(sequence, WINDOW);

    // CONTROL: the journal is still holding descriptions that name that very
    // subject. Without this the equality below would be satisfied by an
    // observer that recorded nothing at all.
    const subjectsSeen = observed.flatMap((t) =>
      t.effects.flatMap((e) => [...(e.subjectIds ?? [])])
    );
    expect(subjectsSeen.length).toBeGreaterThan(0);

    // The journal holds a description of that subject's add and remove for the
    // whole run. If describing it conferred any retention right, the ON arm
    // would still be claimed or still retired here.
    expect(on).toEqual(off);
    expect(on.claimedWhileRestorable).toBe(true);
    expect(on.claimedAfterEviction).toBe(false);
    expect(on.stillRetired).toBe(false);
  });
});

describe('DIAG-JOURNAL-1 F4b: disposal ends observation and changes nothing', () => {
  it('after dispose the tree behaves exactly as an unwatched one', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as unknown as object);

    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    expect(journal.turns().length).toBeGreaterThan(0);

    journal.dispose();

    // Records released, and no further records taken.
    expect(journal.turns()).toEqual([]);
    undoable(() => tree.$.rows.addOne({ id: 'b', name: 'Beta' }));
    await flush();
    const pending = tree.transaction(() => tree.$.n.set(5));
    await flush();
    pending.rollback();
    await flush();
    expect(journal.turns()).toEqual([]);
    expect(journal.transactionEvents()).toEqual([]);

    // And the tree is still fully operational: restoration and transactions
    // both work after the observer is gone.
    expect([...tree.$.rows.ids()].sort()).toEqual(['a', 'b']);
    expect(tree.$.n()).toBe(0);
    tree.undo();
    await flush();
    expect([...tree.$.rows.ids()].sort()).toEqual(['a']);

    // Disposing twice is not an error.
    expect(() => journal.dispose()).not.toThrow();
  });
});
