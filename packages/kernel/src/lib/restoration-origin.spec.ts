import { describe, expect, it } from 'vitest';

import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { restoration } from '../enhancers/restoration/restoration';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';

/**
 * RESTORATION ORIGIN — the DIAG-JOURNAL-0 "B", derived as origin propagation
 * through the EXISTING observation seam rather than as a new channel.
 *
 * > NULL: restoration origin can be preserved through the existing
 * > write/notifier path without changing restoration semantics, creating a new
 * > channel, or widening TURN-FEED.
 *
 * Restorations stay classified as realizations — from the perspective of
 * authorship and history admission they ARE realization-like, and that
 * classification is load-bearing (it is what keeps an undo from recursively
 * admitting itself). What is missing is the more specific provenance.
 *
 * Target matrix:
 *
 *   ordinary authored      participation absent,      source absent
 *   designated authored    participation absent,      source absent,
 *                          restorationDesignated true
 *   external realization   participation realization, source != 'restoration'
 *   undo / redo            participation realization, source == 'restoration'
 */

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Fact = { source: unknown; participation: unknown; designated: unknown };

const observe = () => {
  const seen: Fact[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_n, _p, _path, _owner, source, _s, _pos, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        source: source ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
        designated: m['restorationDesignated'] ?? null,
      });
    }
  );
  return { seen, off };
};

describe('restoration origin: the five falsifiers', () => {
  it('1 — undo() publishes facts with source "restoration"', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();
    undoable(() => tree.$.n(1));
    await flush();

    const { seen, off } = observe();
    tree.undo();
    await flush();
    off();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((f) => f.source === 'restoration')).toBe(true);
    // Still a realization: that classification is what stops an undo from
    // recursively admitting itself.
    expect(seen.every((f) => f.participation === 'realized')).toBe(true);
  });

  it('2 — redo() does the same', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();
    undoable(() => tree.$.n(1));
    await flush();
    tree.undo();
    await flush();

    const { seen, off } = observe();
    tree.redo();
    await flush();
    off();

    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((f) => f.source === 'restoration')).toBe(true);
  });

  it('3 — an external realization never acquires source "restoration"', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();

    const { seen, off } = observe();
    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      tree.$.n(9);
    });
    await flush();
    off();

    // The distinction has to cut both ways, or it is not a distinction.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((f) => f.source === 'restoration')).toBe(false);
    expect(seen.every((f) => f.participation === 'realized')).toBe(true);
  });

  it('4 — restoration creates no new history and does not admit itself', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();
    undoable(() => tree.$.n(1));
    await flush();
    const afterAuthored = tree.getRestorationHistory().length;

    tree.undo();
    await flush();

    expect(tree.getRestorationHistory().length).toBe(afterAuthored);
    expect(tree.$.n()).toBe(0);
  });

  it('5 — P0-C is unchanged: later external truth still blocks the undo', async () => {
    const tree = signalTree({ doc: { title: 'v1' } }, { enhancers: [restoration()] });
    await flush();
    undoable(() => tree.$.doc.title('A'));
    await flush();

    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      tree.$.doc.title('SERVER');
    });
    await flush();

    // The provenance change must not weaken the refusal that P0-C established.
    expect(() => tree.undo()).toThrow(/ST1034/);
    expect(tree.$.doc.title()).toBe('SERVER');
  });

  it('and the authored cases carry NO origin at all', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [restoration()] });
    await flush();

    const { seen, off } = observe();
    tree.$.n(1);
    await flush();
    undoable(() => tree.$.n(2));
    await flush();
    off();

    expect(seen.map((f) => f.participation)).toEqual([null, null]);
    expect(seen.map((f) => f.source)).toEqual([null, null]);
    expect(seen.map((f) => f.designated)).toEqual([null, true]);
  });
});
