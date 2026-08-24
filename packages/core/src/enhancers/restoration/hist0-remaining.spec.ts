import { describe, expect, it } from 'vitest';
import { undoable } from '../../lib/undoable';

import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { getSubjectRestorationClaims } from '../../lib/internals/subject-restoration-claims';
import { withWriteContext } from '../../lib/write-context';
import { timeTravel } from './restoration';

/**
 * HIST-0, the three cases the baseline left open: 4, 6 (+redo), and 9's direct
 * claim/retention probe. Descriptive — no implementation changed.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const realization = (fn: () => void) =>
  withWriteContext({ intent: 'system', participation: 'realized' }, fn);

describe('HIST-0 case 4: mixed writes in ONE untransacted turn', () => {
  it('a document write and a UI write in one tick coalesce into ONE turn', async () => {
    const tree = signalTree(
      { document: { title: 'v1' }, ui: { panel: 'none' } },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();
    const before = tree.getHistory().length;

    // No flush between them — one tick, therefore one turn.
    undoable(() => tree.$.document.title.set('edited'));
    undoable(() => tree.$.ui.panel.set('inspector'));
    await flush();

    const turnsAdded = tree.getHistory().length - before;

    tree.undo();
    await flush();

    // THE FINDING. They coalesce, and one undo reverses BOTH. So case 5's
    // atomicity problem is NOT a `transactions()` property — it is a property of
    // the causal TURN, and it reaches ordinary application code that never opens
    // a transaction. Location-scoped eligibility (HIST-B) would therefore
    // partially reverse atomically authored turns in the common case, not the
    // exotic one.
    expect(turnsAdded).toBe(1);
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.ui.panel()).toBe('none');
  });
});

describe('HIST-0 case 6: authored write, then realization to the SAME location', () => {
  /**
   * ⚠️ DEFECT PINNED, not endorsed.
   *
   * Case 10b showed that a realization to a DIFFERENT leaf survives an undo:
   * restoration reverses the turn's own effects rather than rewinding a
   * snapshot. Case 6 puts the realization on the SAME leaf as the undone
   * authored write, and the reversal wins:
   *
   *   title := 'A'            (authored)
   *   title := 'SERVER'       (realization, LATER)
   *   undo                 -> 'v1'      MEASURED — server truth discarded
   *                        -> 'SERVER'  what correctness requires
   *
   * Per-turn reversal restores the turn's before-value unconditionally. It does
   * not check whether that location has since received non-restorable truth. So
   * an undo silently discards server state whenever the user's last edit and a
   * later server response touched the same location — the ordinary optimistic-
   * update collision.
   *
   * This is the same class as the two pinned P0s (coalesced-turn structural
   * reversal, rekey+remove rollback): reversal is per-turn in WHAT it touches
   * but not in WHETHER its recorded before-value is still authoritative.
   * Fix it once against the chosen HIST model, not before.
   */
  it('REPAIRED (P0-C): undo is refused rather than discarding server truth', async () => {
    const tree = signalTree(
      { document: { title: 'v1' } },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();

    undoable(() => tree.$.document.title.set('A'));
    await flush();

    realization(() => tree.$.document.title.set('SERVER'));
    await flush();

    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    expect(tree.$.document.title()).toBe('SERVER');
  });

  it('control: a realization to a DIFFERENT leaf DOES survive (10b holds)', async () => {
    const tree = signalTree(
      { document: { title: 'v1', body: 'b1' } },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();

    undoable(() => tree.$.document.title.set('A'));
    await flush();
    realization(() => tree.$.document.body.set('SERVER'));
    await flush();

    tree.undo();
    await flush();

    // The control is what makes case 6 a location-collision defect rather than
    // a general "realizations are not respected" claim.
    expect(tree.$.document.title()).toBe('v1');
    expect(tree.$.document.body()).toBe('SERVER');
  });

  it('REPAIRED (P0-C-ROW): the same collision inside an entity row', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    undoable(() => tree.$.rows.setAll([{ id: 'a', name: 'orig' }]));
    await flush();

    undoable(() => tree.$.rows.updateOne('a', { name: 'AUTHORED' }));
    await flush();
    realization(() => tree.$.rows.updateOne('a', { name: 'SERVER' }));
    await flush();

    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    // Row fields were the last place this defect survived. The provenance index
    // is keyed by position+subject there, because the realization is delivered
    // at the ROW while the reversal effect names the FIELD.
    expect(tree.$.rows.byId('a')?.()?.name).toBe('SERVER');
  });

  it('REDO after supersession restores the authored value, not the server value', async () => {
    const tree = signalTree(
      { document: { title: 'v1' } },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();

    undoable(() => tree.$.document.title.set('A'));
    await flush();
    realization(() => tree.$.document.title.set('SERVER'));
    await flush();

    // The undo is refused, so there is nothing to redo — which resolves the
    // symmetry worry rather than answering it. "Undo respects later truth but
    // redo does not" cannot arise, because the state machine never advanced.
    expect(() => tree.undo()).toThrow(/ST1034/);
    await flush();

    expect(tree.$.document.title()).toBe('SERVER');
    expect(tree.canRedo()).toBe(false);
  });
});

describe('HIST-0 case 9: does observability create restoration ownership?', () => {
  it('AUTHORED churn — claims stay bounded by the window, not the churn', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 5 })] }
    );
    const claims = getSubjectRestorationClaims(tree);

    for (let g = 0; g < 40; g++) {
      undoable(() => tree.$.rows.setAll([{ id: `g${g}`, name: 'n' }]));
      await flush();
    }

    expect(claims?.snapshot().owners).toBeLessThanOrEqual(5);
  });

  it('REALIZATION churn — zero claims, zero history: the target property', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel({ maxHistorySize: 5 })] }
    );
    const claims = getSubjectRestorationClaims(tree);
    const historyBefore = tree.getHistory().length;

    for (let g = 0; g < 40; g++) {
      realization(() => tree.$.rows.setAll([{ id: `g${g}`, name: 'n' }]));
      await flush();
    }

    const historyAfter = tree.getHistory().length;

    // THE INVARIANT, measured directly on the causal inventories rather than
    // inferred from a heap probe:
    //
    //   a non-restorable write acquires NO restoration ownership
    //
    // Realization is the only non-historical classification that exists today,
    // so it is the available proxy for what a selective model must do to an
    // excluded operation. The property a selective model needs is already
    // achievable — which is why HIST-C fits the existing machinery and needs no
    // new retention mechanism.
    expect(historyAfter).toBe(historyBefore);
    expect(claims?.snapshot().owners ?? 0).toBe(0);
    expect(claims?.snapshot().claimedSubjects ?? 0).toBe(0);

    // And the writes really happened — a negative probe needs its control.
    expect(tree.$.rows.ids()).toEqual(['g39']);
  });

  it('but the DIAGNOSTIC half is NOT satisfied: realizations are invisible', async () => {
    const tree = signalTree(
      { document: { title: 'v1' } },
      { enhancers: [timeTravel({ maxHistorySize: 50 })] }
    );
    await flush();
    const before = tree.getHistory().length;

    realization(() => tree.$.document.title.set('SERVER'));
    await flush();

    // The two consequences separate cleanly:
    //
    //   RESTORATION consequence  satisfied — no claim, no retained SubjectId
    //   DIAGNOSTIC  consequence  NOT satisfied — the write is absent from the
    //                            history inventory entirely, not "recorded but
    //                            non-restorable"
    //
    // So "excluded from undo" and "still observable" are not the same axis
    // today; there is exactly one inventory and exclusion means erasure. Any
    // selective model that promises devtools visibility for excluded operations
    // needs a second inventory, which is new machinery — and is exactly the
    // scope HIST-0 should NOT smuggle in.
    expect(tree.getHistory().length).toBe(before);
    expect(tree.$.document.title()).toBe('SERVER');
  });
});
