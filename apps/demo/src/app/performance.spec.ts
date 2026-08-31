import { TestBed } from '@angular/core/testing';
import { batching, signalTree } from '@signal-tree/kernel';

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Quick SignalTree Performance Test
 * This runs actual SignalTree operations to get real performance data
 *
 * ⚠️ ON DEMAND VIA `ST_PERF=1` — PERF-GATE-DETERMINISM-0.
 *
 * Every case here is a WALL-CLOCK measurement, and one of them asserts a RATIO
 * of two timings (`(single * 10) / batched > 0.5`). Under the parallel test pool
 * CPU and memory contention across workers skews absolute times and ratios
 * independently of the code under test, so this suite interrupted the full
 * 52-gate release register three times while passing 3/3 in isolation.
 *
 * The remedy is the one Phase 5 already established for
 * `benchmarks.spec.ts` and the stored-marker timing suite, applied verbatim
 * rather than reinvented:
 *
 * ```text
 * correctness suite   deterministic semantic/complexity assertions — always run
 * performance suite   wall-clock measurement — explicitly opted into
 * ```
 *
 * ⚠️ THE THRESHOLD WAS NOT RAISED. Nudging `0.5` down until CI usually passes
 * would delete the falsifier while keeping the flake; the assertion is intact
 * and still fails under `ST_PERF=1` if batching genuinely regresses. And a red
 * gate that routinely means "run it again" is not evidence — that is the whole
 * cost this pays off.
 *
 * The batching claim is ALSO covered deterministically elsewhere: the
 * notification-coalescing behaviour is asserted by counting notifications in
 * core's batching specs, which is where the real invariant lives. This suite
 * measures how fast it is, not whether it is correct.
 */
// ⚠️ NOT `describe.runIf` — that is Vitest, and the demo runs JEST. Core's
// benchmarks.spec.ts uses `runIf` because core runs Vitest; copying the idiom
// verbatim threw `describe.runIf is not a function` and the suite silently
// stopped loading while the run still reported passes.
const RUN_TIMING = process.env['ST_PERF'] === '1';
const timingDescribe = RUN_TIMING ? describe : describe.skip;

timingDescribe('SignalTree Performance Benchmarks', () => {
  let performanceResults: any;

  beforeAll(() => {
    TestBed.configureTestingModule({});
    performanceResults = {};
  });

  function measureTime(fn: () => void, iterations = 1000): number {
    const times: number[] = [];

    // Warm-up
    for (let i = 0; i < 50; i++) {
      fn();
    }

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const trimmed = times.slice(
      Math.floor(iterations * 0.1),
      Math.floor(iterations * 0.9)
    );

    return trimmed[Math.floor(trimmed.length / 2)];
  }

  interface NestedState {
    [key: string]:
      | NestedState
      | {
          value: number;
          timestamp: number;
          id: string;
          counter?: number;
        };
  }

  function generateNestedState(depth: number, breadth: number): any {
    if (depth === 0) {
      return {
        value: Math.random(),
        timestamp: Date.now(),
        id: crypto.randomUUID(),
      };
    }

    const obj: any = {};
    for (let i = 0; i < breadth; i++) {
      obj[`level_${depth}_item_${i}`] = generateNestedState(depth - 1, breadth);
    }
    return obj;
  }

  function generateEntities(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `entity_${i}`,
      name: `Entity ${i}`,
      value: Math.random() * 1000,
      active: Math.random() > 0.5,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    }));
  }

  it('should benchmark tree initialization performance', () => {
    const smallState = generateNestedState(2, 3); // ~27 nodes
    const mediumState = generateNestedState(3, 4); // ~85 nodes
    const largeState = generateNestedState(4, 4); // ~341 nodes

    const smallTime = measureTime(() => {
      const tree = signalTree(smallState);
      tree.$();
    });

    const mediumTime = measureTime(() => {
      const tree = signalTree(mediumState);
      tree.$();
    });

    const largeTime = measureTime(() => {
      const tree = signalTree(largeState);
      tree.$();
    });

    performanceResults.initialization = {
      small: { nodes: 27, time: smallTime },
      medium: { nodes: 85, time: mediumTime },
      large: { nodes: 341, time: largeTime },
    };

    // Performance should be reasonable
    expect(smallTime).toBeLessThan(10);
    expect(mediumTime).toBeLessThan(20);
    expect(largeTime).toBeLessThan(50);
  });

  it('should benchmark update performance', () => {
    const state = generateNestedState(3, 4);
    const tree = signalTree(state);

    const shallowTime = measureTime(() => {
      tree.$((state: NestedState) => ({ ...state, counter: Math.random() }));
    });

    const deepTime = measureTime(() => {
      tree.$((state: any) => {
        const newState = { ...state };
        if (newState.level_3_item_0) {
          newState.level_3_item_0 = {
            ...newState.level_3_item_0,
            level_2_item_0: {
              ...newState.level_3_item_0.level_2_item_0,
              value: Math.random(),
            },
          };
        }
        return newState;
      });
    });

    performanceResults.updates = {
      shallow: shallowTime,
      deep: deepTime,
    };

    expect(shallowTime).toBeLessThan(5);
    expect(deepTime).toBeLessThan(10);
  });

  it('should benchmark batching performance', () => {
    const state = generateNestedState(3, 4);
    const regularTree = signalTree(state);
    const batchTree = signalTree(state, { enhancers: [batching()] }) as any;

    const singleUpdateTime = measureTime(() => {
      regularTree.$((state: any) => ({ ...state, value: Math.random() }));
    });

    const batchedUpdateTime = measureTime(() => {
      batchTree.batch(() => {
        for (let i = 0; i < 10; i++) {
          batchTree.$((s: any) => ({ ...s, [`field_${i}`]: Math.random() }));
        }
      });
    }, 100); // Fewer iterations for batched operations

    const efficiency = (singleUpdateTime * 10) / batchedUpdateTime;

    performanceResults.batching = {
      single: singleUpdateTime,
      batched: batchedUpdateTime,
      efficiency,
    };

    // Batching efficiency varies in micro-benchmarks; just verify it completes
    // Real benefit is in batched CD notifications, not raw update speed
    expect(batchedUpdateTime).toBeGreaterThan(0);
    expect(efficiency).toBeGreaterThan(0.5); // Should be at least half as efficient
  });

  it('should benchmark memoization performance', () => {
    // Removed in 9.0.1: memoization enhancer deleted. Use Angular computed() directly.
    expect(true).toBe(true);
  });

  // 'lazy loading vs eager loading' lived here and is deleted with the lazy
  // feature in 15.0. It compared two trees built with `lazy: lazy()` against
  // one built eagerly — and since v11 the lazy branch only differed if the
  // feature was injected from `@signal-tree/kernel/lazy`, a subpath withdrawn
  // from the published surface. There is one construction path now, so there
  // is nothing left to compare.
});
