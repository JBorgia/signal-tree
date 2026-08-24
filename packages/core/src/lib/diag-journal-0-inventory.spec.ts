import { describe, expect, it } from 'vitest';

import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';
import { undoable } from './undoable';
import { withWriteContext } from './write-context';

/**
 * DIAG-JOURNAL-0 — INVENTORY, not implementation.
 *
 * > NULL: can DevTools observe every causal turn without that observation
 * > becoming another restoration authority or retention owner?
 *
 * Before proposing a journal object, measure what the EXISTING seams already
 * expose at the point a turn is complete enough to describe. The disposition
 * depends only on that:
 *
 *   A  existing causal-runtime facts are sufficient  -> read-only projection
 *   B  one specific fact is missing                  -> narrowest seam for it
 *   C  observation requires retaining restoration-owned/live state, subject
 *      ownership, or another reversal authority       -> the shape is wrong
 *   U  cannot tell which boundary owns the fact       -> derive first
 *
 * This file only records what is observable. It adds no journal and no seam.
 */

type Row = { id: string; name: string };

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

type Observed = {
  path: string;
  source: unknown;
  participation: unknown;
  designated: unknown;
  transactionId: unknown;
};

/** Everything a diagnostic observer can see from the notifier today. */
const observe = () => {
  const seen: Observed[] = [];
  const off = getPathNotifier().subscribe(
    '**',
    (_next, _prev, path, _ownerPath, source, _subjectIds, _positionIds, meta) => {
      const m = (meta ?? {}) as Record<string, unknown>;
      seen.push({
        path: String(path),
        source: source ?? m['origin'] ?? null,
        participation: m['participation'] ?? null,
        designated: m['restorationDesignated'] ?? null,
        transactionId: m['transactionId'] ?? null,
      });
    }
  );
  return { seen, off };
};

describe('DIAG-JOURNAL-0 inventory: what the notifier already exposes', () => {
  it('CASE 1+2 — authored writes are observable, and DESIGNATION is an attribute', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();

    tree.$.n.set(1); // ordinary: zero restoration history
    await flush();
    undoable(() => tree.$.n.set(2)); // designated
    await flush();
    off();

    // Both are observable as the same KIND of causal occurrence, and
    // eligibility is a flag on the fact rather than a separate mechanism —
    // which is exactly what case 2 requires.
    expect(seen.map((s) => s.designated)).toEqual([null, true]);

    // And only the designated one became restoration history.
    expect(tree.getRestorationHistory().length - 1).toBe(1);
  });

  it('CASE 3 — a realization is distinguishable from authored work', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    const { seen, off } = observe();

    withWriteContext({ intent: 'system', participation: 'realized' }, () => {
      tree.$.n.set(9);
    });
    await flush();
    off();

    expect(seen.map((s) => s.participation)).toEqual(['realized']);
    // ...and it acquired no restoration right by being seen.
    expect(tree.getRestorationHistory().length - 1).toBe(0);
  });

  it('CASE 7 — REPAIRED: a restoration carries its own origin', async () => {
    const tree = signalTree({ n: 0 }, { enhancers: [timeTravel()] });
    await flush();
    undoable(() => tree.$.n.set(1));
    await flush();

    const { seen, off } = observe();
    tree.undo();
    await flush();
    off();

    // THE MEASUREMENT THIS FILE EXISTED FOR, now the other way round. This was
    // the one missing fact: a restoration published its writes as realizations
    // with no more specific origin, so at the observation seam an undo was
    // indistinguishable from a server refresh.
    //
    // Repaired by propagating origin through the existing write path — the
    // classification is unchanged (still a realization, which is what stops an
    // undo recursively admitting itself) and the provenance is now present.
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.participation === 'realized')).toBe(true);
    expect(seen.every((s) => s.source === 'restoration')).toBe(true);
  });

  it('CASE 4+5 — transaction identity is on the fact; lifecycle is separate', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel(), transactions()] }
    );
    await flush();
    const { seen, off } = observe();

    const pending = undoable(() =>
      tree.transaction(() => {
        tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
      })
    );
    await flush();
    pending.confirm();
    await flush();
    off();

    // The writes carry their transaction id, so a projection can group them
    // without inventing its own boundary. The four lifecycle PHASES are not on
    // the write at all — they live on the TURN-FEED channel, which is why a
    // journal has to consume that channel rather than infer phases from writes.
    expect(seen.some((s) => typeof s.transactionId === 'number')).toBe(true);
  });

  it('CASE 8 — the turn boundary is the FLUSH, and it is observable', async () => {
    const tree = signalTree({ a: 0, b: 0 }, { enhancers: [timeTravel()] });
    await flush();

    let flushes = 0;
    const off = getPathNotifier().onFlush(() => {
      flushes += 1;
    });

    // Two writes, one tick — one causal turn.
    undoable(() => {
      tree.$.a.set(1);
      tree.$.b.set(1);
    });
    await flush();
    off();

    // A projection can take its boundary from the engine instead of guessing a
    // finer one, which is what case 8 requires.
    expect(flushes).toBe(1);
    expect(tree.getRestorationHistory().length - 1).toBe(1);
  });
});

describe('DIAG-JOURNAL-0 inventory: what a projection would RETAIN', () => {
  it('the notifier hands over VALUES, not live tree nodes', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel()] }
    );
    await flush();

    const payloads: unknown[] = [];
    const off = getPathNotifier().subscribe('**', (next) => {
      payloads.push(next);
    });
    undoable(() => tree.$.rows.addOne({ id: 'a', name: 'Alpha' }));
    await flush();
    off();

    // Bears directly on the representation constraint: a projection that stores
    // what it is handed stores DESCRIPTIONS, not live causal objects. Nothing
    // delivered here is callable — no signals, no node accessors, no capture
    // buckets — so retaining it cannot pin a subject graph.
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads.every((p) => typeof p !== 'function')).toBe(true);
  });

  it('and SUBSCRIBING creates no restoration or transaction ownership', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>({ selectId: (r) => r.id }) },
      { enhancers: [timeTravel(), transactions()] }
    );
    await flush();

    const beforeHistory = tree.getRestorationHistory().length;
    const beforeCanUndo = tree.canUndo();

    const off = getPathNotifier().subscribe('**', () => {
      /* an observer that does nothing */
    });
    tree.$.rows.addOne({ id: 'a', name: 'Alpha' });
    await flush();
    off();

    // The first half of the ownership falsifier set, measurable without a
    // journal: observation alone changes no restoration state. An undesignated
    // write stays unadmitted even while something is watching it.
    expect(tree.getRestorationHistory().length).toBe(beforeHistory);
    expect(tree.canUndo()).toBe(beforeCanUndo);
  });
});
