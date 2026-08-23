import { describe, expect, it } from 'vitest';

import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './time-travel';

/**
 * STEP 8 PHASE 6C — is a release-only sink COMPLETE?
 *
 * `release(owner) -> newlyUnowned` only ever reports subjects that HAD a claim
 * and lost the last one. There is a second category it structurally cannot
 * reach:
 *
 *   A. FORMERLY OWNED   claim count 1 -> 0. A release event exists. The sink
 *                       driven from `release()` handles it.
 *   B. NEVER OWNED      claim count 0 -> 0. No release event ever occurs, so a
 *                       release-driven sink leaves it retained forever.
 *
 * The old zero-owner path cannot cover B either: it returns immediately whenever
 * the tree has ANY restoration authority, which a `timeTravel()` tree always
 * has.
 *
 * So the question is whether B exists in practice, and these tests answer it by
 * accumulating every subject that is EVER claimed across a run and comparing
 * that against everything that was ever retired. The Phase 1 ownership probe
 * measured `physicallyRetained - currentlyOwned` and could not tell A from B;
 * this can.
 *
 * ## ⚠️ The premature-reclamation hazard this must NOT be solved with
 *
 * The tempting fix is to reclaim inside the entity retirement path when
 * `claims.isClaimed(id) === false`. That is unsafe: capture happens on the
 * notifier flush, AFTER the mutation boundary, so at the moment of retirement
 * the claim has legitimately not been authored yet. Every test here therefore
 * checks the claim state BOTH at the retirement instant and after the flush,
 * and the gap between them is the finding.
 */

type Row = { id: string; name: string };

const tick = () => Promise.resolve();

type Rows = {
  addOne(row: Row): void;
  removeOne(id: string): void;
  setAll(rows: Row[]): void;
  ids(): string[];
  __acquireEntityHandleForTesting?: (
    id: string
  ) => { subjectId: number } | undefined;
  __listSubjectReclamationCandidates?: () => readonly number[];
};

type Store = {
  $: { rows: Rows; other: Rows };
  getHistory(): Array<{ restorationSubjectIds?: number[] }>;
  undo(): void;
  redo(): void;
};

const makeTree = (maxHistorySize: number) =>
  signalTree(
    {
      rows: entityMap<Row, string>({ selectId: (r) => r.id }),
      other: entityMap<Row, string>({ selectId: (r) => r.id }),
    },
    { enhancers: [timeTravel({ maxHistorySize })] }
  ) as unknown as Store;

const retired = (rows: Rows): readonly number[] =>
  rows.__listSubjectReclamationCandidates?.() ?? [];

describe('never-claimed retirements', () => {
  it('THE HAZARD: a subject can be unclaimed AT the retirement instant', async () => {
    // Why the sink must not be driven from the retirement path by asking
    // `isClaimed`. Capture runs on the notifier flush, AFTER the mutation
    // boundary, so between the two the removal's claim does not exist yet.
    //
    // A subject still inside the window is protected by the entry that ADDED
    // it — the first version of this test measured that and proved nothing. The
    // hazard needs a subject whose add entry has already been evicted, so
    // nothing claims it at the moment it retires.
    const WINDOW = 3;
    const tree = makeTree(WINDOW);
    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();
    const subject = tree.$.rows.__acquireEntityHandleForTesting?.('a')
      ?.subjectId as number;
    const claims = getSubjectRestorationClaims(tree);

    // Churn other rows until `a`'s add entry falls out of the window.
    for (let i = 0; i < WINDOW * 3; i++) {
      tree.$.rows.addOne({ id: `filler-${i}`, name: 'f' });
      await tick();
      await tick();
    }
    expect(claims?.isClaimed(subject)).toBe(false);

    tree.$.rows.removeOne('a');
    // Synchronously after the mutation and before the flush: still unclaimed,
    // and now RETIRED. A sink that reclaimed here would destroy the backing the
    // entry about to be captured is going to claim.
    expect(retired(tree.$.rows)).toContain(subject);
    expect(claims?.isClaimed(subject)).toBe(false);

    await tick();
    await tick();

    // The flush authors the claim. This gap is the whole reason the second door
    // has to be a post-settlement event and not the retirement itself.
    expect(claims?.isClaimed(subject)).toBe(true);
  });

  it('measures category B across a churn run', async () => {
    const WINDOW = 5;
    const tree = makeTree(WINDOW);
    const claims = getSubjectRestorationClaims(tree);
    if (!claims) {
      throw new Error('Expected a claim registry');
    }

    const everClaimed = new Set<number>();
    const everRetired = new Set<number>();
    const observe = () => {
      for (const id of claims.claimedSubjects()) everClaimed.add(id);
      for (const id of retired(tree.$.rows)) everRetired.add(id);
    };

    for (let g = 0; g < 30; g++) {
      tree.$.rows.setAll([
        { id: `g${g}-a`, name: 'a' },
        { id: `g${g}-b`, name: 'b' },
      ]);
      await tick();
      await tick();
      observe();
    }

    const neverClaimed = [...everRetired].filter((id) => !everClaimed.has(id));

    // The measurement, whichever way it lands. If this is empty, a
    // release-driven sink is complete for ordinary churn and category B is a
    // theoretical concern; if it is not, the sink needs a second door.
    expect(everRetired.size).toBeGreaterThan(0);
    expect(neverClaimed).toEqual([]);
  });

  it('a collection nothing writes retires nothing, so there is no B to find there', async () => {
    // The shape category B was expected to come from: a second collection in a
    // restoration-capable tree. It only produces retirements if something
    // retires from it, and when it does, the same ambient capture claims them.
    const WINDOW = 4;
    const tree = makeTree(WINDOW);
    const claims = getSubjectRestorationClaims(tree);

    tree.$.other.setAll([{ id: 'o1', name: 'x' }]);
    await tick();
    await tick();
    const otherSubject = tree.$.other.__acquireEntityHandleForTesting?.('o1')
      ?.subjectId as number;

    tree.$.other.removeOne('o1');
    await tick();
    await tick();

    expect(retired(tree.$.other)).toContain(otherSubject);
    expect(claims?.isClaimed(otherSubject)).toBe(true);
  });

  it('subjects retired BY an undo are claimed too', async () => {
    // The strongest category-B candidate. An undo retires the subjects the
    // forward operation created, and an undo records no new entry — so if
    // anything were going to be retired without a claim, it would be these.
    const tree = makeTree(20);
    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();
    tree.$.rows.addOne({ id: 'b', name: 'Beta' });
    await tick();
    await tick();

    const bSubject = tree.$.rows.__acquireEntityHandleForTesting?.('b')
      ?.subjectId as number;

    tree.undo();
    await tick();
    await tick();

    expect(tree.$.rows.ids()).toEqual(['a']);
    const claims = getSubjectRestorationClaims(tree);

    // `b`'s subject is retired now and redo has to bring it back, so something
    // must be keeping it.
    expect(retired(tree.$.rows)).toContain(bSubject);
    expect(claims?.isClaimed(bSubject)).toBe(true);

    tree.redo();
    await tick();
    expect(tree.$.rows.ids().sort()).toEqual(['a', 'b']);
  });

  it('CATEGORY A confirmed: eviction leaves a retired subject unclaimed and retained', async () => {
    // The state the release-driven sink exists to clean up, pinned so the sink
    // has something to be measured against.
    const WINDOW = 3;
    const tree = makeTree(WINDOW);
    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await tick();
    await tick();
    const subject = tree.$.rows.__acquireEntityHandleForTesting?.('a')
      ?.subjectId as number;

    tree.$.rows.removeOne('a');
    await tick();
    await tick();
    const claims = getSubjectRestorationClaims(tree);
    expect(claims?.isClaimed(subject)).toBe(true);

    for (let i = 0; i < WINDOW * 3; i++) {
      tree.$.rows.addOne({ id: `filler-${i}`, name: 'f' });
      await tick();
      await tick();
    }

    // Unclaimed — no legal traversal can bring it back — and still holding
    // physical backing. 945 B of it, at the measured rate.
    expect(claims?.isClaimed(subject)).toBe(false);
    expect(retired(tree.$.rows)).toContain(subject);
  });
});
