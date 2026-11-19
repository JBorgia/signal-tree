// BEGIN MEMORY-ONLY INSTRUMENTATION
import { appendFileSync as appendMemoryRow } from 'node:fs';
import { getHeapStatistics as memoryHeapStatistics } from 'node:v8';
function memoryStage(stage: string): void {
  const sink=process.env['ST_MEMORY_OUTPUT'];
  if(!sink)throw new Error('ST_MEMORY_OUTPUT is required');
  const usage=process.memoryUsage(),v8=memoryHeapStatistics();
  appendMemoryRow(sink,JSON.stringify({stage,at:Date.now(),pid:process.pid,node:process.version,execArgv:process.execArgv,size:LARGE,...usage,heapSizeLimit:v8.heap_size_limit,totalAvailableSize:v8.total_available_size,usedHeapSize:v8.used_heap_size,numberOfNativeContexts:v8.number_of_native_contexts,numberOfDetachedContexts:v8.number_of_detached_contexts})+'\n');
}
// END MEMORY-ONLY INSTRUMENTATION
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
const LARGE = 512;

describe('entity batches larger than the argument limit', () => {
  // Timeout added on v16 (no assertion changed): without slice 9's demand
  // gate v16 builds every row's notification payload, so this case measured
  // ~1–2.5 s alone and 7 s under parallel load (v15: ~0.7 s); membership
  // observation itself adds little (probes/perf.log).
  it('setAll, replace and clear with membership observed', () => {
    memoryStage('membership:before-create'); // MEMORY-ONLY
    const tree = signalTree({ rows: entityMap<Row, number>() });
    memoryStage('membership:after-create'); // MEMORY-ONLY
    const reader = entityMembershipReader(tree)!;
    let events = 0;
    const stop = reader.subscribe(() => events++);
    try {
    memoryStage('membership:before-seed'); // MEMORY-ONLY
      tree.$.rows.setAll(rows(LARGE));
    memoryStage('membership:after-seed'); // MEMORY-ONLY
    memoryStage('membership:before-replace'); // MEMORY-ONLY
      tree.$.rows.setAll(rows(LARGE, LARGE));
    memoryStage('membership:after-replace'); // MEMORY-ONLY
    memoryStage('membership:before-clear'); // MEMORY-ONLY
      tree.$.rows.setAll([]);
    memoryStage('membership:after-clear'); // MEMORY-ONLY
      expect(tree.$.rows.count()).toBe(0);
      expect(events).toBeGreaterThan(0);
    memoryStage('membership:after-original-assertions'); // MEMORY-ONLY
    } finally {
    memoryStage('membership:before-stop'); // MEMORY-ONLY
      stop();
    memoryStage('membership:after-stop'); // MEMORY-ONLY
    memoryStage('membership:before-destroy'); // MEMORY-ONLY
      tree.destroy();
    memoryStage('membership:after-destroy'); // MEMORY-ONLY
    }
  }, 60_000);

  it('undo and redo of a setAll that replaced every row', async () => {
    memoryStage('restoration:before-create'); // MEMORY-ONLY
    const tree = signalTree(
      { rows: entityMap<Row, number>() },
      { enhancers: [restoration()] }
    );
    memoryStage('restoration:after-create'); // MEMORY-ONLY
    try {
    memoryStage('restoration:before-seed'); // MEMORY-ONLY
      tree.$.rows.setAll(rows(LARGE));
    memoryStage('restoration:after-seed'); // MEMORY-ONLY
      await flush();
    memoryStage('restoration:after-original-drain'); // MEMORY-ONLY
    memoryStage('restoration:before-replace'); // MEMORY-ONLY
      undoable(() => tree.$.rows.setAll(rows(LARGE, LARGE)));
    memoryStage('restoration:after-replace'); // MEMORY-ONLY
      await flush();
    memoryStage('restoration:after-original-drain'); // MEMORY-ONLY
    memoryStage('restoration:before-undo'); // MEMORY-ONLY
      tree.undo();
    memoryStage('restoration:after-undo'); // MEMORY-ONLY
      expect(tree.$.rows.count()).toBe(LARGE);
      expect(tree.$.rows.ids()[0]).toBe(0);
    memoryStage('restoration:after-undo-assertions'); // MEMORY-ONLY
    memoryStage('restoration:before-redo'); // MEMORY-ONLY
      tree.redo();
    memoryStage('restoration:after-redo'); // MEMORY-ONLY
      expect(tree.$.rows.ids()[0]).toBe(LARGE);
    memoryStage('restoration:after-redo-assertion'); // MEMORY-ONLY
    } finally {
    memoryStage('restoration:before-destroy'); // MEMORY-ONLY
      tree.destroy();
    memoryStage('restoration:after-destroy'); // MEMORY-ONLY
    }
    await flush(); // MEMORY-ONLY final bounded drain
    memoryStage('restoration:after-final-drain'); // MEMORY-ONLY
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
