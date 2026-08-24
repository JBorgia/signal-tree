import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';

/**
 * SEMANTICS-NAMES-0 — is `source` / `participation` one dimension or two?
 *
 * > FALSIFIER: if a single `origin` axis cannot represent the measured
 * > distinctions without losing a genuinely independent dimension currently
 * > carried by `source` or `participation`, the consolidation is wrong.
 *
 * What each field DECIDES today, from its consumers rather than its name:
 *
 *   participation   admission (does this enter restoration history / a
 *                transaction's confirmed effects?) and COALESCING (may this
 *                batch with a neighbouring write?)
 *                -> "how does this participate in authored causal semantics?"
 *
 *   source       filtering (skip my own output), SIDE-EFFECT POLICY (a devtools
 *                scrub must not write through to storage), and labelling
 *                -> "what originated this application?"
 *
 * This file measures the value combinations that actually occur. If the two axes
 * only ever move together, they are one dimension wearing two names. If any
 * combination varies one without the other, they are two.
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Fact = { origin: unknown; participation: unknown };

const observe = () => {
  const seen: Fact[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_n, _p, _path, _owner, source, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        origin: source ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
      });
    }
  );
  return { seen, off };
};

describe('SEMANTICS-NAMES-0: the measured combination space', () => {
  it('authored — no origin, no participation marker', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();
    undoable(() => tree.$.n.set(1));
    await flush();
    off();

    expect(seen).toEqual([{ origin: null, participation: null }]);
  });

  it('external realization — no origin, realization participation', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();
    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      tree.$.n.set(9);
    });
    await flush();
    off();

    expect(seen).toEqual([{ origin: null, participation: 'realized' }]);
  });

  it('restoration — time-travel origin, realization participation', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    undoable(() => tree.$.n.set(1));
    await flush();

    const { seen, off } = observe();
    tree.undo();
    await flush();
    off();

    expect(seen.length).toBeGreaterThan(0);
    expect(
      seen.every(
        (f) => f.origin === 'restoration' && f.participation === 'realized'
      )
    ).toBe(true);
  });

  it('THE DECIDING CASE — a devtools state application', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel(), transactions()] });
    await flush();

    const { seen, off } = observe();
    // This is the context `devTools()` establishes for JUMP_TO_STATE /
    // ROLLBACK / IMPORT_STATE before calling applyState(). Reproduced here
    // rather than driven through the Redux bridge, so the combination is
    // measured without a browser extension.
    withWriteContext({ intent: 'system', origin: 'devtools' }, () => {
      tree.$.n.set(42);
    });
    await flush();
    off();

    // THE MEASUREMENT THE FALSIFIER TURNS ON. A devtools application carries a
    // non-default ORIGIN with DEFAULT participation — it is treated as authored
    // for admission and coalescing while being labelled devtools for
    // side-effect policy (`stored()` declines to persist it).
    //
    // So the two fields DO vary independently, and a single `origin` axis cannot
    // carry this without also deciding what devtools participation should BE.
    // That is DEVTOOLS-JUMP-0's question, not this one's.
    expect(seen).toEqual([{ origin: 'devtools', participation: null }]);
  });
});
