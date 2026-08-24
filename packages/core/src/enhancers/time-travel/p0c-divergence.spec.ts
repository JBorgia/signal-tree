import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { withWriteContext } from '../../lib/write-context';
import { timeTravel } from './time-travel';

/**
 * RESTORE-P0 P0-C — world-relative validity.
 *
 * P0-D settled FRAME-relative validity: "can this inverse be applied given what
 * this same frame will also do?" That was derivable from the frame's contents.
 *
 * P0-C is the harder neighbour: "can this inverse be applied given what
 * happened AFTER the turn?" That is not derivable — it is a policy, and the
 * chosen one is:
 *
 * > an undo either reverses the authored operation, or it does not happen
 *
 * Refusal, not partial application and not overwriting later truth. Skipping the
 * conflicting effect would make an authored turn partially reversible, which is
 * the HIST-B failure arriving through a different door. Letting undo win would
 * make the history system an authority over facts it does not own.
 *
 * These cases CHARACTERISE current behaviour first. Anything asserting the
 * defect is marked.
 */

type Doc = { title: string; description: string };
type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

const makeDoc = () =>
  signalTree(
    { doc: { title: 'v1', description: 'd1' } as Doc },
    { enhancers: [timeTravel({ maxHistorySize: 50 })] }
  );

describe('P0-C C1 — scalar collision', () => {
  it('REPAIRED: undo is REFUSED, and the server value survives', async () => {
    const tree = makeDoc();
    await flush();

    undoable(() => tree.$.doc.title.set('A'));
    await flush();

    realization(() => tree.$.doc.title.set('SERVER'));
    await flush();

    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    // No mutation. The refusal names the location and both values, so a caller
    // can decide what to do — the core does not choose for them.
    expect(tree.$.doc.title()).toBe('SERVER');
  });
});

describe('P0-C C2 — structural collision', () => {
  it('a user rekey and a realization rekey of the same subject', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'Alpha' }]));
    await flush();

    undoable(() => tree.$.rows.changeId('a', 'b'));
    await flush();

    realization(() => tree.$.rows.changeId('b', 'c'));
    await flush();
    expect(tree.$.rows.ids()).toEqual(['c']);

    // Structural divergence was ALREADY refused before P0-C, by the existing
    // `structural-drift` check: a subject rekeyed away fails to build a prepared
    // realization context. So the world-relative model was half built — the
    // structural half detected, the scalar half not detected at all.
    expect(() => tree.undo()).toThrow();
    await flush();

    // Unchanged, which is the property that matters.
    expect(tree.$.rows.ids()).toEqual(['c']);
  });
});

describe('P0-C C3 — THE ATOMICITY CASE: mixed safe and unsafe in one turn', () => {
  it('REPAIRED: one conflicting location refuses the WHOLE turn', async () => {
    const tree = makeDoc();
    await flush();

    // ONE turn touching two locations.
    undoable(() => tree.$.doc.title.set('A'));
    undoable(() => tree.$.doc.description.set('B'));
    await flush();

    // Only ONE of them is superseded.
    realization(() => tree.$.doc.title.set('SERVER'));
    await flush();

    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    // THE ATOMICITY RESULT. `description` had no conflict and is still NOT
    // restored, because the operation it belongs to could not be reversed as a
    // whole. Skipping just the conflicting effect would have restored it and
    // left the title — partially reversing an atomically authored operation,
    // which is the HIST-B failure through a different door.
    expect(tree.$.doc.description()).toBe('B');
    expect(tree.$.doc.title()).toBe('SERVER');
  });
});

describe('P0-C C4 — the state machine after a refusal', () => {
  it('records where the undo cursor sits after a conflicting undo', async () => {
    const tree = makeDoc();
    await flush();

    undoable(() => tree.$.doc.title.set('A'));
    await flush();
    const indexBefore = tree.getCurrentIndex();

    realization(() => tree.$.doc.title.set('SERVER'));
    await flush();

    const canRedoBefore = tree.canRedo();
    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    // A refused undo is not a navigation. The cursor does not move and redo
    // state is untouched, so the caller can retry after resolving the conflict
    // without the history having drifted underneath them.
    expect(tree.getCurrentIndex()).toBe(indexBefore);
    expect(tree.canRedo()).toBe(canRedoBefore);
  });
});
