import { describe, expect, it } from 'vitest';

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { asyncSource } from './async-source';
import { getPathNotifier } from '../path-notifier';
import { restoration } from '../../enhancers/restoration/restoration';
import { signalTree } from '../signal-tree';
import { undoable } from '../undoable';

/**
 * MATRIX-CLOSE M9 — is `asyncSource` a SECOND, unclassified ingress path?
 *
 * `asyncSource` is exported from the root barrel and its entire job is acquiring
 * external data, but it contains no `withWriteContext`: the loaded value lands
 * via a bare `dataSignal.set(value)`.
 *
 * PER-B fixed exactly this shape in `stored().reload()` — an acquired value
 * applied as AUTHORED work, which cost two defects (an undo destroying it, a
 * rollback reverting it). The question is whether the same defect exists here.
 *
 * ⚠️ MEASURED, NOT INFERRED, because PER-B's P1 taught the counter-lesson: a
 * write that never reaches the causal substrate has nothing to classify. If
 * `asyncSource`'s signals are outside it, there is no defect and no work to do.
 *
 * ## And it took THREE harness attempts, which is the point
 *
 * The first two probes reported `causalEvents: 0` for the WRONG REASON — the
 * load never ran, because `asyncSource` takes `{ initial, load }` rather than a
 * bare loader, and its accessor IS the value rather than exposing `.data()`.
 * Recording either would have logged the right conclusion from broken evidence:
 * exactly the failure mode this audit keeps finding in other people's tests.
 *
 * The load is therefore asserted explicitly (`before` 0, `after` 7) so a future
 * harness break shows up as a failure rather than as a silent zero.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('M9: asyncSource ingress classification', () => {
  it('does a load produce a causal event at all?', async () => {
    await TestBed.runInInjectionContext(async () => {
    const tree = signalTree(
      {
        users: asyncSource<number>({ initial: 0, load: () => of(7) }),
      },
      { enhancers: [restoration()] }
    );

    // Materialise, then let the deferred auto-load run.
    const before = tree.$.users();
    const seen: Array<{ path: string; origin: unknown; participation: unknown }> =
      [];
    const off = getPathNotifier().subscribe(
      '**',
      (_n, _p, path, _owner, origin, _s, _pos, meta) => {
        const m = (meta ?? {}) as Record<string, unknown>;
        seen.push({
          path,
          origin: origin ?? m['origin'] ?? null,
          participation: m['participation'] ?? null,
        });
      }
    );
    await flush();
    await flush();
    off();

    // ⚠️ THE SUSPICION IS REFUTED. The load happened (0 -> 7) and produced ZERO
    // causal events. `asyncSource`'s value lives OUTSIDE the causal substrate —
    // the same category as PER-B's P1 autoload, not the same category as
    // `stored().reload()`.
    //
    // So there is nothing to classify: no turn to admit, no location for P0-C to
    // protect, no contribution for a transaction to capture. A bare
    // `dataSignal.set(value)` with no write context is CORRECT here, and adding
    // `external()` around it would be classifying a non-event.
    expect(before).toBe(0);
    expect(tree.$.users()).toBe(7);
    expect(seen.length).toBe(0);
    expect(tree.getRestorationHistory().length).toBe(1);
    expect(tree.canUndo()).toBe(false);
    });
  });

  it('can an undo of authored work destroy a loaded value?', async () => {
    await TestBed.runInInjectionContext(async () => {
    const tree = signalTree(
      {
        users: asyncSource<number>({ initial: 0, load: () => of(7) }),
        label: 'initial',
      },
      { enhancers: [restoration()] }
    );
    void tree.$.users();
    await flush();
    await flush();

    undoable(() => tree.$.label.set('authored'));
    await flush();

    const loadedBefore = tree.$.users();

    let refusal: unknown = 'no-refusal';
    try {
      tree.undo();
    } catch (error) {
      refusal = (error as { message?: string })?.message?.slice(0, 6);
    }
    await flush();

    // The confirming half: the undo reverses the authored write and the loaded
    // value is untouched — not because it is protected, but because it was never
    // part of the causal record. PER-B's two defects (undo destroying durable
    // truth, rollback reverting a reload) have no analogue here.
    expect(loadedBefore).toBe(7);
    expect(tree.$.users()).toBe(7);
    expect(tree.$.label()).toBe('initial');
    expect(refusal).toBe('no-refusal');
    });
  });
});
