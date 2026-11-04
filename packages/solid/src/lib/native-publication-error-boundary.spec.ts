import { createComputed, createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import {
  createSignalTreeFactory,
  replaceLocation,
  type EpochHandle,
  type ObservationAdapter,
} from '@signal-tree/kernel/adapter';

import { entityMap, transactions } from '../index';
// Test-only non-observing authority check; keep this private seam out of the SDK.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { peekInternalTransactionRuntime } from '../../../kernel/src/enhancers/transactions/transactions';
// Test-only non-observing authority check; keep this private seam out of the SDK.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { hasOpenCommitScope } from '../../../kernel/src/lib/internals/commit-consequence';
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

function fixture(observeCollection = false) {
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
  const collectionSeen: number[][] = [];
  const subscribers = createRoot((dispose) => {
    const a = createMemo(() => one()?.v ?? -1);
    const b = createMemo(() => two()?.v ?? -1);
    const pair = createMemo(() => [a(), b()]);
    createComputed(() => {
      seen.push([...pair()]);
    });
    // Fault injection must target an actually realized writable collection
    // token. Held row memos alone only exercise the separate epoch path.
    if (observeCollection) {
      const collection = createMemo(() => tree.$.rows.all().map(row => row.v));
      createComputed(() => { collectionSeen.push([...collection()]); });
    }
    return { dispose, a, b, pair };
  });
  return {
    instrument,
    tree,
    seen,
    collectionSeen,
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
      const f = fixture(fault === 'writable-token');
      try {
        expect(f.seen.at(-1)).toEqual([0, 0]); // Reject SSR/no-op observer fixture.
        if (fault === 'writable-token') expect(f.collectionSeen.at(-1)).toEqual([0, 0]);
        f.instrument.start('none');
        f.replaceBoth(1);
        const control = f.instrument.snapshot();
        const controlSeen = f.seen.map((pair) => [...pair]);
        expect(controlSeen.at(-1)).toEqual([1, 1]);
        expect(controlSeen.length).toBeGreaterThan(1);
        expect(control.advances.length).toBeGreaterThanOrEqual(2);
        expect(new Set(control.advances).size).toBeGreaterThanOrEqual(2);
        if (fault === 'writable-token') {
          expect(control.tokenCalls).toBeGreaterThan(0);
          expect(f.collectionSeen.at(-1)).toEqual([1, 1]);
        }
        expect(control.frames.every((frame) => frame.returnedNormally)).toBe(
          true
        );

        // Same realized lifetimes/write shape. Fault on last *observed* epoch,
        // not first: missing sibling handles must not explain a timing red.
        f.instrument.start(fault, control.advances.length);
        const outcome = attempt(() => f.replaceBoth(2));
        // Freeze history BEFORE any ST direct read or memo demand can repair it.
        const afterFault = f.seen.map((pair) => [...pair]);
        const collectionAfterFault = f.collectionSeen.map(pair => [...pair]);
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
        if (fault === 'writable-token') {
          expect(collectionAfterFault.at(-1)).toEqual([2, 2]);
          expect(collectionAfterFault.every(([a, b]) => a === b)).toBe(true);
        }
        expect(afterFault.every(([a, b]) => a === b)).toBe(true);
        expect([f.subscribers.a(), f.subscribers.b()]).toEqual([2, 2]);

        // A subsequent public write, NOT an invented public retryDelivery API.
        f.instrument.start('none');
        f.replaceBoth(3);
        const next = f.seen.map((pair) => [...pair]);
        expect(next.at(-1)).toEqual([3, 3]);
        if (fault === 'writable-token') expect(f.collectionSeen.at(-1)).toEqual([3, 3]);
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


describe('Solid mixed settlement member publication failures', () => {
  it.each(['error', 'undefined'] as const)(
    'finishes sibling publication before reporting the first %s member-token failure',
    (failure) => {
      const base = createSolidObservationAdapter();
      const marker = failure === 'error' ? new Error('member token publication') : undefined;
      let selectingMember = false;
      let armed = false;
      let hits = 0;
      let nextToken = 0;
      const memberTokens = new Set<number>();
      const adapter: ObservationAdapter = {
        ...base,
        createWritableCell<T>(read: () => T) {
          const realized = required(base.createWritableCell)(read);
          const token = ++nextToken;
          return {
            ...realized,
            cell: new Proxy(realized.cell, {
              apply(target, receiver, args) {
                if (selectingMember) memberTokens.add(token);
                return Reflect.apply(target, receiver, args);
              },
            }),
            token: {
              observe() {
                if (selectingMember) memberTokens.add(token);
                realized.token.observe();
              },
              invalidate() {
                realized.token.invalidate();
                if (armed && hits === 0 && memberTokens.has(token)) {
                  hits++;
                  throw marker;
                }
              },
            },
          };
        },
      };
      const group: {
        keep: number;
        optional: { x: number; y: number | undefined };
      } = { keep: 0, optional: { x: 200, y: undefined } };
      const tree = createSignalTreeFactory(adapter)({
        count: 100,
        group,
        rows: entityMap<{ id: string; value: number }>(),
      }, { enhancers: [transactions()] });
      let dispose: (() => void) | undefined;
      try {
        const rows = tree.$.rows;
        const optional = required(tree.$.group.optional);
        rows.addOne({ id: 'A', value: 300 });
        rows.setActiveId('A');
        const held = rows.byIdOrFail('A');
        selectingMember = true;
        optional.x();
        selectingMember = false;
        expect(memberTokens.size).toBeGreaterThan(0);
        // Preserve the JavaScript whole-value omission counterexample. The
        // strict TypeScript branch writer intentionally requires every field.
        Reflect.apply(tree.$.group, undefined, [{ keep: 0 }]);
        const read = () => ({
          snapshot: tree.$(), count: tree.$.count(),
          optional: optional(),
          ids: [...rows.ids()], all: rows.all().map(row => ({ ...row })),
          direct: rows.byIdOrFail('A')().value, held: held().value,
          activeId: rows.activeId(), active: rows.activeEntity()?.value,
        });
        const baseline = structuredClone(read());
        const seen: Array<ReturnType<typeof read>> = [];
        dispose = createRoot(off => {
          createComputed(() => seen.push(structuredClone(read())));
          return off;
        });
        expect(seen).toEqual([baseline]);
        // SDK locations use the same writable binding as Solid facade .set.
        const pending = tree.transact(() => {
          replaceLocation(tree.$.count, 101);
          replaceLocation(optional.x, 201);
          rows.updateOne('A', { value: 301 });
        });
        expect(tree.$.count()).toBe(101);
        expect(optional.x()).toBe(201);
        expect(held().value).toBe(301);
        expect(required(peekInternalTransactionRuntime(tree)).getPendingTurnCount()).toBe(1);
        expect(hasOpenCommitScope(tree)).toBe(true);
        expect(seen.at(-1)?.count).toBe(101);
        const start = seen.length;
        armed = true;
        const outcome = attempt(() => pending.rollback());
        armed = false;
        // Freeze actual deliveries before a direct read can refresh any cache.
        const deliveries = seen.slice(start);
        expect(hits).toBe(1);
        expect(outcome.threw).toBe(true);
        expect(outcome.error).toBe(marker);
        expect(deliveries.length).toBeGreaterThan(0);
        for (const delivered of deliveries) expect(delivered).toEqual(baseline);
        expect(read()).toEqual(baseline);
        expect(rows.byIdOrFail('A')).toBe(held);
        expect(required(peekInternalTransactionRuntime(tree)).getPendingTurnCount()).toBe(0);
        expect(hasOpenCommitScope(tree)).toBe(false);
        const after = seen.length;
        expect(attempt(() => pending.rollback()).threw).toBe(false);
        expect(read()).toEqual(baseline);
        expect(seen).toHaveLength(after);
      } finally {
        armed = false;
        selectingMember = false;
        dispose?.();
        tree.destroy();
        base.dispose();
      }
    }
  );
});
