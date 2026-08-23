import { describe, expect, it } from 'vitest';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from './time-travel';

/**
 * ⚠️ PINS A DEFECT. The `DEFECT:` case below asserts WRONG BEHAVIOUR, recorded
 * so it is visible and so fixing it is a deliberate change to this file. Same
 * treatment as `rekeyed-rollback-defect.spec.ts`, which is the same family:
 * structural effects composed inside ONE turn are only partially reversed.
 *
 * ## The defect
 *
 * When a single un-flushed turn both CREATES rows and REMOVES one of them,
 * undoing that turn restores the removed row instead of reversing the creation.
 * The collection was empty before the turn, so undo must empty it.
 *
 *   setAll([a, b]); removeOne('a')   in ONE turn, from an empty collection
 *   undo()  ->  ["a"]                WRONG — should be []
 *
 * It is specifically about a subject the SAME turn created. A turn that removes
 * a row which existed beforehand reverses correctly, and so does the identical
 * sequence with a flush between the operations.
 *
 * ## Why it matters more than it looks
 *
 * Writes in one tick coalesce, which is the normal case in an Angular app —
 * two calls in the same event handler are one turn. This was found by the very
 * first realistic script run against a packed tarball during the 15.0 release
 * rehearsal, not by a targeted probe.
 *
 * ## Provenance
 *
 * PRE-EXISTING. Reproduces identically at `5c74381a`, `d487a4ae`, `d9451b42`,
 * `80216dea` and HEAD — that is, before Step 8 started, before and after the
 * transactions rollback repair, and before and after the reclamation sink.
 * Verified in clean worktrees at each commit rather than assumed.
 *
 * ## Not fixed here
 *
 * It is reversal composition, not retention, and Step 8 is frozen. Repairing it
 * inside a memory change would mix two failure domains in one bisect. When it is
 * fixed, replace this file — do not loosen it.
 */

type Row = { id: string; name: string; v: number };

const tick = () => Promise.resolve();

type Tree = {
  $: {
    rows: {
      setAll(rows: Row[]): void;
      addOne(row: Row): void;
      removeOne(id: string): void;
      ids(): string[];
    };
  };
  undo(): void;
};

const makeTree = (): Tree =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
    { enhancers: [timeTravel({ maxHistorySize: 10 })] }
  ) as unknown as Tree;

const A = { id: 'a', name: 'Alpha', v: 1 };
const B = { id: 'b', name: 'Beta', v: 2 };

describe('reversal of a coalesced turn', () => {
  it('CONTROL: a flush between the operations reverses correctly', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([A, B]);
    await tick();
    await tick();
    tree.$.rows.removeOne('a');
    await tick();
    await tick();
    expect(tree.$.rows.ids()).toEqual(['b']);

    tree.undo();
    await tick();
    await tick();
    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
  });

  it('CONTROL: a coalesced turn touching PRE-EXISTING rows reverses correctly', async () => {
    const tree = makeTree();
    tree.$.rows.setAll([A, B]);
    await tick();
    await tick();

    // One turn, two structural effects, neither on a subject this turn created.
    tree.$.rows.removeOne('a');
    tree.$.rows.addOne({ id: 'c', name: 'Gamma', v: 3 });
    await tick();
    await tick();
    expect(tree.$.rows.ids()).toEqual(['b', 'c']);

    tree.undo();
    await tick();
    await tick();
    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
  });

  it('DEFECT: a turn that creates then removes restores the removed row', async () => {
    const tree = makeTree();

    // ONE turn, from an empty collection: it creates a and b, then removes a.
    tree.$.rows.setAll([A, B]);
    tree.$.rows.removeOne('a');
    await tick();
    await tick();
    expect(tree.$.rows.ids()).toEqual(['b']);

    tree.undo();
    await tick();
    await tick();

    // CORRECT WOULD BE `[]` — the turn created everything here, so reversing it
    // empties the collection. Instead the removal is reversed and the creation
    // is not, leaving the row the turn itself introduced.
    expect(tree.$.rows.ids()).toEqual(['a']);
  });
});
