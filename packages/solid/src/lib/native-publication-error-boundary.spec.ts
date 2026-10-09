import { createComputed, createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import {
  createSignalTreeFactory,
  type EpochHandle,
  type ObservationAdapter,
} from '@signal-tree/kernel/adapter';

import { entityMap } from '../index';
import { createSolidObservationAdapter } from './solid-observation';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing required test capability');
  return value;
}

type Fault = 'none' | 'writable-token' | 'last-epoch' | 'first-epoch';
type Row = { id: number; v: number };

/** Delegate real invalidation first; never replace Solid's batch or notify. */
function instrumentedAdapter() {
  const base = createSolidObservationAdapter();
  const marker = new Error('after completed native invalidation');
  const epochIds = new WeakMap<EpochHandle, number>();
  let nextEpoch = 0;
  let depth = 0;
  let mode: Fault = 'none';
  let selectedEpoch = 0;
  let hits = 0;
  let tokenCalls = 0;
  let advances: number[] = [];
  let frames: { depth: number; returnedNormally: boolean }[] = [];
  const adapter: ObservationAdapter = {
    ...base,
    createEpoch() {
      const epoch = required(base.createEpoch)();
      epochIds.set(epoch, nextEpoch++);
      return epoch;
    },
    advanceEpoch(epoch) {
      required(base.advanceEpoch)(epoch);
      advances.push(required(epochIds.get(epoch)));
      if (
        hits === 0 &&
        ((mode === 'first-epoch' && advances.length === 1) ||
          (mode === 'last-epoch' && advances.length === selectedEpoch))
      ) {
        hits++;
        throw marker;
      }
    },
    createWritableCell<T>(read: () => T) {
      const realized = required(base.createWritableCell)(read);
      return {
        ...realized,
        token: {
          observe: () => realized.token.observe(),
          invalidate() {
            realized.token.invalidate();
            tokenCalls++;
            if (mode === 'writable-token' && hits === 0) {
              hits++;
              throw marker;
            }
          },
        },
      };
    },
    runInvalidationGroup(run) {
      const frame = { depth: ++depth, returnedNormally: false };
      frames.push(frame);
      try {
        base.runInvalidationGroup(() => {
          run();
          frame.returnedNormally = true;
        });
      } finally {
        depth--;
      }
    },
  };
  return {
    adapter,
    marker,
    dispose: base.dispose,
    start(nextMode: Fault, ordinal = 0) {
      mode = nextMode;
      selectedEpoch = ordinal;
      hits = 0;
      tokenCalls = 0;
      advances = [];
      frames = [];
    },
    snapshot: () => ({
      hits,
      tokenCalls,
      advances: [...advances],
      frames: frames.map((frame) => ({ ...frame })),
      depth,
    }),
  };
}

function fixture() {
  const instrument = instrumentedAdapter();
  const tree = createSignalTreeFactory(instrument.adapter)({
    rows: entityMap<Row, number>(),
  });
  tree.registerCleanup(instrument.dispose);
  const replaceBoth = (v: number) =>
    tree.$.rows.setAll([
      { id: 1, v },
      { id: 2, v },
    ]);
  replaceBoth(0);
  const one = required(tree.$.rows.byId(1));
  const two = required(tree.$.rows.byId(2));
  const seen: number[][] = [];
  const subscribers = createRoot((dispose) => {
    const a = createMemo(() => one()?.v ?? -1);
    const b = createMemo(() => two()?.v ?? -1);
    const pair = createMemo(() => [a(), b()]);
    createComputed(() => {
      seen.push([...pair()]);
    });
    return { dispose, a, b, pair };
  });
  return {
    instrument,
    tree,
    seen,
    replaceBoth,
    subscribers,
    direct: () => [one()?.v, two()?.v],
    dispose() {
      subscribers.dispose();
      tree.destroy();
      instrument.dispose();
    },
  };
}

function attempt(run: () => void): { threw: boolean; error: unknown } {
  try {
    run();
    return { threw: false, error: undefined };
  } catch (error) {
    return { threw: true, error };
  }
}

describe('Solid public EntityMap publication error timing', () => {
  it.each(['writable-token', 'last-epoch'] as const)(
    'completes native bookkeeping before reporting a post-%s invalidation fault',
    (fault) => {
      const f = fixture();
      try {
        expect(f.seen.at(-1)).toEqual([0, 0]); // Reject SSR/no-op observer fixture.
        f.instrument.start('none');
        f.replaceBoth(1);
        const control = f.instrument.snapshot();
        const controlSeen = f.seen.map((pair) => [...pair]);
        expect(controlSeen.at(-1)).toEqual([1, 1]);
        expect(controlSeen.length).toBeGreaterThan(1);
        expect(control.advances.length).toBeGreaterThanOrEqual(2);
        expect(new Set(control.advances).size).toBeGreaterThanOrEqual(2);
        if (fault === 'writable-token')
          expect(control.tokenCalls).toBeGreaterThan(0);
        expect(control.frames.every((frame) => frame.returnedNormally)).toBe(
          true
        );

        // Same realized lifetimes/write shape. Fault on last *observed* epoch,
        // not first: missing sibling handles must not explain a timing red.
        f.instrument.start(fault, control.advances.length);
        const outcome = attempt(() => f.replaceBoth(2));
        // Freeze history BEFORE any ST direct read or memo demand can repair it.
        const afterFault = f.seen.map((pair) => [...pair]);
        const publication = f.instrument.snapshot();
        expect(publication.hits).toBe(1);
        expect(outcome.threw).toBe(true);
        expect(outcome.error).toBe(f.instrument.marker);
        expect(
          publication.advances,
          'all calibrated epoch handles attempted'
        ).toEqual(control.advances);
        expect(publication.depth).toBe(0);
        expect(f.direct()).toEqual([2, 2]); // Source committed despite publication error.
        expect(
          publication.frames.every((frame) => frame.returnedNormally)
        ).toBe(true);
        expect(afterFault.at(-1)).toEqual([2, 2]);
        expect(afterFault.every(([a, b]) => a === b)).toBe(true);
        expect([f.subscribers.a(), f.subscribers.b()]).toEqual([2, 2]);

        // A subsequent public write, NOT an invented public retryDelivery API.
        f.instrument.start('none');
        f.replaceBoth(3);
        const next = f.seen.map((pair) => [...pair]);
        expect(next.at(-1)).toEqual([3, 3]);
        expect(next.every(([a, b]) => a === b)).toBe(true);
      } finally {
        f.dispose();
      }
    }
  );

  it('separately retains the later-epoch-handle obligation after a first-handle fault', () => {
    const f = fixture();
    try {
      f.instrument.start('none');
      f.replaceBoth(1);
      const control = f.instrument.snapshot();
      expect(f.seen.at(-1)).toEqual([1, 1]);
      expect(new Set(control.advances).size).toBeGreaterThanOrEqual(2);

      f.instrument.start('first-epoch');
      const outcome = attempt(() => f.replaceBoth(2));
      const beforeDemand = f.seen.map((pair) => [...pair]);
      const publication = f.instrument.snapshot();
      expect(publication.hits).toBe(1);
      expect(outcome.threw).toBe(true);
      expect(outcome.error).toBe(f.instrument.marker);
      expect(f.direct()).toEqual([2, 2]);
      // This is a separate drain test. The current epochPublisher clears the
      // whole set and has no per-handle catch; reporting outside the group alone
      // cannot restore unattempted handles. Keep its red visible, never skip it.
      expect(publication.advances, 'separate epoch-drain obligation').toEqual(
        control.advances
      );
      expect(beforeDemand.at(-1)).toEqual([2, 2]);
      expect(beforeDemand.every(([a, b]) => a === b)).toBe(true);
    } finally {
      f.dispose();
    }
  });
});
