import { computed } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { createDiagnosticJournal } from './internals/diagnostics/diagnostic-journal';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import {
  acquireScalarProjection,
  EXTERNAL_ACQUISITION,
} from './internals/acquire-projection';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';

/**
 * BIND-BRANCH-0 — EXTERNAL PROVENANCE FOLLOWS SUPPLIED INFORMATION, NOT
 * DOWNSTREAM CAUSATION.
 *
 * ## ⚠️ The question was wrong first, and the correction matters
 *
 * This started as *"is a branch retrieve ONE causal turn?"* — which is too
 * coarse in both directions. Too coarse ONE way because a payload of three
 * values legitimately produces three mutation events; too coarse the OTHER
 * because "everything downstream of the acquisition" must NOT inherit its
 * authority. Otherwise:
 *
 * ```text
 * storage -> external write -> effect -> write -> effect -> write
 *                                  ALL somehow "external"
 * ```
 *
 * and the provenance axis is destroyed by contagion. The debugger consequence is
 * the concrete version: load `theme = 'light'` and watch six unrelated fields
 * change under one external banner, and the honest developer reaction is *where
 * did all that other data come from?*
 *
 * So the invariant under test is:
 *
 * ```text
 * DIRECTLY MATERIALIZED FROM THE PAYLOAD   belongs to the acquisition
 * REACTIONS CAUSED BY APPLYING IT          keep their own causal semantics
 * ```
 *
 * ## The turn observable, and why "one turn" cannot be the invariant
 *
 * Both candidate observables collapse WITHIN a tick, measured below:
 *
 * ```text
 * diagnostic journal   closes a turn on the notifier FLUSH (`onFlush`)
 * restoration history  three separate `undoable()` calls in ONE tick produce
 *                      ONE entry, not three
 * ```
 *
 * So nothing in the runtime exposes a within-tick turn boundary, and a
 * `turns().length === 1` assertion would pass for anything synchronous. What IS
 * observable per effect is its own `origin` / `participation`, which is exactly
 * what the boundary rule needs — and what these tests use instead.
 *
 * A branch node is callable with a partial (deep merge, `NodeAccessor<T>`). It
 * deliberately has no `.set()`; that is the Rule 0d line.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    {
      settings: {
        theme: 'light',
        units: 'imperial',
        distancePrecision: 2,
      },
    },
    { enhancers: [restoration(), transactions()] }
  );

/** What Y actually supplied. `distancePrecision` is deliberately NOT in it. */
const PAYLOAD = { theme: 'dark', units: 'metric' };

type Effect = {
  path: string;
  origin?: string;
  participation?: string;
  transactionId?: number;
};

/**
 * ⚠️ Read the effects BEFORE disposing. `turns()` returns the LIVE array and
 * `dispose()` does `turns.length = 0`, so a reference taken first is emptied
 * under you. That cost one debugging round here.
 */
const drain = (journal: { turns(): readonly { effects: readonly unknown[] }[]; dispose(): void }): Effect[] => {
  const effects = journal.turns().flatMap((t) => t.effects) as Effect[];
  const copy = effects.map((e) => ({ ...e }));
  journal.dispose();
  return copy;
};

describe('BIND-BRANCH-0: what belongs to an external acquisition?', () => {
  it('every value the payload supplied is materialized and classified external', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);
    const historyBefore = tree.getRestorationHistory().length;

    acquireScalarProjection(
      tree.$.settings as unknown as Record<string, unknown>,
      PAYLOAD,
      EXTERNAL_ACQUISITION
    );
    await flush();
    const effects = drain(journal);

    expect(tree.$.settings()).toMatchObject(PAYLOAD);

    // Both payload members are individually VISIBLE — the acquisition is not an
    // opaque blob. That is what lets a debugger say which values storage
    // actually supplied.
    expect(effects.map((e) => e.path).sort()).toEqual([
      'settings.theme',
      'settings.units',
    ]);
    for (const e of effects) {
      expect(e.origin).toBe('external');
      expect(e.participation).toBe('realized');
      expect(e.transactionId).toBeUndefined();
    }

    // Acquiring durable truth is not authored work: it earns no undo.
    expect(tree.getRestorationHistory().length - historyBefore).toBe(0);
    expect(tree.canUndo()).toBe(false);
  });

  it('CONTROL — the same branch write WITHOUT external() is authored', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);

    // Completed to a WHOLE value: `distancePrecision` keeps its current 2, so
    // only theme and units change and the two-effect assertion is untouched.
    tree.$.settings({ ...PAYLOAD, distancePrecision: 2 });
    await flush();
    const effects = drain(journal);

    // Without this arm, "everything is external" could be an artifact of the
    // journal rather than a property of `external()`.
    expect(effects.length).toBe(2);
    for (const e of effects) {
      expect(e.origin).toBeUndefined();
      expect(e.participation).toBeUndefined();
    }
  });

  it('⚠️ THE BOUNDARY — an authored reaction in the SAME tick does NOT inherit external', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);

    acquireScalarProjection(
      tree.$.settings as unknown as Record<string, unknown>,
      PAYLOAD,
      EXTERNAL_ACQUISITION
    );
    // Application logic reacting to metric units. Storage never said the
    // precision was 1 — the application rule did. Same tick, deliberately: if
    // provenance were contagious, timing would be what leaked it.
    tree.$.settings.distancePrecision.set(1);
    await flush();
    const effects = drain(journal);

    const byPath = Object.fromEntries(effects.map((e) => [e.path, e]));
    expect(byPath['settings.theme'].origin).toBe('external');
    expect(byPath['settings.units'].origin).toBe('external');

    // The load-bearing assertion. Provenance follows SUPPLIED INFORMATION, not
    // downstream causation.
    expect(byPath['settings.distancePrecision'].origin).toBeUndefined();
    expect(byPath['settings.distancePrecision'].participation).toBeUndefined();
  });

  it('a DERIVATION produces no mutation event at all', async () => {
    const tree = makeTree();
    await flush();
    const foreground = computed(() =>
      tree.$.settings.theme() === 'light' ? 'black' : 'white'
    );
    expect(foreground()).toBe('black');

    const journal = createDiagnosticJournal(tree as object);
    acquireScalarProjection(
      tree.$.settings as unknown as Record<string, unknown>,
      PAYLOAD,
      EXTERNAL_ACQUISITION
    );
    await flush();
    const effects = drain(journal);

    // Nobody set `foreground`; it follows `theme`. A derived value must not
    // appear as a third write competing with the two the payload supplied.
    expect(foreground()).toBe('white');
    expect(effects.map((e) => e.path).sort()).toEqual([
      'settings.theme',
      'settings.units',
    ]);
  });
});

/**
 * What the runtime CANNOT currently express, pinned so it is not rediscovered.
 */
describe('BIND-BRANCH-0: the limits of the current turn model', () => {
  it('⚠️ restoration history collapses three designated turns in one tick into ONE', async () => {
    const tree = makeTree();
    await flush();
    const before = tree.getRestorationHistory().length;

    undoable(() => tree.$.settings.theme.set('dark'));
    undoable(() => tree.$.settings.units.set('metric'));
    undoable(() => tree.$.settings.distancePrecision.set(1));
    await flush();

    // Three explicit designations, one entry. So history-entry count is a
    // TICK counter, not a turn counter — which is why "one retrieve = one
    // causal turn" cannot be stated as a testable invariant today.
    expect(tree.getRestorationHistory().length - before).toBe(1);
  });

  it('⚠️ the journal carries per-effect provenance but NO causal edge', async () => {
    const tree = makeTree();
    await flush();
    const journal = createDiagnosticJournal(tree as object);

    acquireScalarProjection(
      tree.$.settings as unknown as Record<string, unknown>,
      PAYLOAD,
      EXTERNAL_ACQUISITION
    );
    tree.$.settings.distancePrecision.set(1);
    await flush();
    const turns = journal.turns();
    const turnCount = turns.length;
    const sequences = turns.map((t) => t.sequence);
    journal.dispose();

    // Acquisition and reaction share ONE turn with ONE sequence number. Each
    // effect still carries its own origin, so "where did that come from?" is
    // answerable — but "what caused what" is not: there is no `causedBy` on
    // `DiagnosticEffect`, so the chain
    //
    //     external theme -> authored precision
    //
    // is representable only as co-membership in a flush. Restoring the chain is
    // diagnostic-journal correlation metadata, NOT a new causal dimension.
    expect(turnCount).toBe(1);
    expect(sequences).toEqual([0]);
  });
});
