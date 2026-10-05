import { describe, expect, it } from 'vitest';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { undoable } from './undoable';
import { entityMembershipReader } from './internals/entity-membership-view';
import { restoration } from '../enhancers/restoration/restoration';

// `array.push(...items)` passes every item as an argument, and V8 throws
// "Maximum call stack size exceeded" past ~10^5 arguments. Found by the
// 2026-09-30 performance audit: a 200k-row setAll threw while membership was
// observed (Studio's entity evidence).
//
// Carried from v15 012fd11d (v16 integration slice 5). The donor's first case
// observes membership through `entityMembershipReader`; preserved in slice 5
// (preserved/entity-large-batches.spec.ts.txt), it is restored unchanged with
// the reader in slice 6. v16's own large-batch call sites (notifier delivery, transaction rollback,
// restoration turn composition) are covered by
// entity-large-batches-v16-controls.spec.ts.
type Row = { id: number; n: number };
const rows = (count: number, offset = 0): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: i + offset, n: i }));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
// Past V8's ~1.2e5 argument limit, small enough for a restoration-enabled undo.
const LARGE = 130_000;

describe('entity batches larger than the argument limit', () => {
  it('setAll, replace and clear with membership observed', () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    const reader = entityMembershipReader(tree)!;
    let events = 0;
    const stop = reader.subscribe(() => events++);
    try {
      tree.$.rows.setAll(rows(LARGE));
      tree.$.rows.setAll(rows(LARGE, LARGE));
      tree.$.rows.setAll([]);
      expect(tree.$.rows.count()).toBe(0);
      expect(events).toBeGreaterThan(0);
    } finally {
      stop();
      tree.destroy();
    }
  });

  it('undo and redo of a setAll that replaced every row', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(rows(LARGE));
      await flush();
      undoable(() => tree.$.rows.setAll(rows(LARGE, LARGE)));
      await flush();
      tree.undo();
      expect(tree.$.rows.count()).toBe(LARGE);
      expect(tree.$.rows.ids()[0]).toBe(0);
      tree.redo();
      expect(tree.$.rows.ids()[0]).toBe(LARGE);
    } finally {
      tree.destroy();
    }
  }, 120_000);
});

// Guard the historical per-removal findIndex search, not wall-clock time or
// every possible quadratic implementation. Allow one full scan per setAll;
// searching from the start for each removed row visits n * (n + 1) / 2 items.
// Fixtures are built before counting. Only synchronous setAll work is counted;
// no await or assertion runs with the prototype instrumented. Do not make these
// tests concurrent. Other Vitest files run in isolated workers.
function findIndexVisits(action: () => void): number {
  const original = Array.prototype.findIndex;
  let visits = 0;
  Array.prototype.findIndex = function <T>(
    this: T[],
    predicate: (value: T, index: number, array: T[]) => unknown,
    thisArg?: unknown
  ): number {
    return original.call(this, (value: T, index: number, array: T[]) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  };
  try {
    action();
    return visits;
  } finally {
    Array.prototype.findIndex = original;
  }
}

describe('setAll removal neighbour search work', () => {
  it('counts predicate visits and restores instrumentation even on failure', () => {
    const original = Array.prototype.findIndex;
    const values = [10, 20, 30];
    const context = { target: 20 };
    let found = -1;
    const visits = findIndexVisits(() => {
      found = values.findIndex(function (this: typeof context, value) {
        return value === this.target;
      }, context);
    });
    expect(found).toBe(1);
    expect(visits).toBe(2);
    expect(Array.prototype.findIndex).toBe(original);
    const error = new Error('instrumented predicate failed');
    expect(() =>
      findIndexVisits(() => {
        values.findIndex(() => {
          throw error;
        });
      })
    ).toThrow(error);
    expect(Array.prototype.findIndex).toBe(original);
  });

  describe.each(['plain', 'observed'] as const)('%s tree', (mode) => {
    const check = async (count: number, replacement: Row[]) => {
      const initial = rows(count);
      const initialIds = initial.map((row) => row.id);
      const replacementIds = replacement.map((row) => row.id);
      const tree = signalTree(
        { rows: entityMap<Row, number>() },
        { enhancers: mode === 'observed' ? [restoration()] : [] }
      );
      try {
        tree.$.rows.setAll(initial);
        await flush();
        const apply = () => tree.$.rows.setAll(replacement);
        const visits = findIndexVisits(() => {
          if (mode === 'observed') undoable(apply);
          else apply();
        });
        expect(
          visits,
          'findIndex predicate visits during setAll'
        ).toBeLessThanOrEqual(count);
        expect(tree.$.rows.ids()).toEqual(replacementIds);
        if (mode === 'observed') {
          // Restoration receives the structural removal payloads. Verify it
          // actually captured the operation so demand gating cannot make this
          // path vacuous; undo also checks all pre-state neighbour positions.
          await flush();
          tree.undo();
          expect(tree.$.rows.ids()).toEqual(initialIds);
        }
      } finally {
        tree.destroy();
      }
    };

    it.each([256, 1_024])('replacing every id (%i rows)', async (count) => {
      await check(count, rows(count, count));
    });

    it.each([256, 1_024])(
      'clearing with setAll([]) (%i rows)',
      async (count) => {
        await check(count, []);
      }
    );
  });
});
