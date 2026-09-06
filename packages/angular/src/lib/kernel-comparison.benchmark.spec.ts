import { signal } from '@angular/core';
import { signalTree } from '@signal-tree/kernel';
import { describe, expect, it } from 'vitest';

const RUN_TIMING = process.env['ST_PERF'] === '1';
const ITERATIONS = 10_000;

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const benchmark = (run: () => void, warmup = 100, runs = 50): number => {
  for (let index = 0; index < warmup; index++) run();

  const times: number[] = [];
  for (let index = 0; index < runs; index++) {
    const start = performance.now();
    run();
    times.push(performance.now() - start);
  }
  return median(times);
};

const stableRatio = (
  baseline: () => void,
  candidate: () => void,
  repeats = 7
): number => {
  const ratios: number[] = [];
  for (let index = 0; index < repeats; index++) {
    const base = Math.max(benchmark(baseline), 1e-4);
    ratios.push(benchmark(candidate) / base);
  }
  return Math.min(...ratios);
};

describe.runIf(RUN_TIMING)('Benchmark: neutral kernel vs raw Angular signal()', () => {
  it('creation overhead is bounded (< 50x for 20 keys)', () => {
    const ratio = stableRatio(
      () => {
        for (let index = 0; index < 100; index++) {
          const signals: Record<string, ReturnType<typeof signal<number>>> = {};
          for (let key = 0; key < 20; key++) {
            signals[`key_${key}`] = signal(key);
          }
        }
      },
      () => {
        for (let index = 0; index < 100; index++) {
          const state: Record<string, number> = {};
          for (let key = 0; key < 20; key++) state[`key_${key}`] = key;
          signalTree(state, { capabilities: ['causal-runtime'] }).destroy();
        }
      }
    );

    expect(ratio).toBeLessThan(50);
  });

  it('read overhead is bounded (< 5x per access)', () => {
    const state: Record<string, number> = {};
    const signals: Record<string, ReturnType<typeof signal<number>>> = {};
    for (let index = 0; index < 20; index++) {
      state[`key_${index}`] = index;
      signals[`key_${index}`] = signal(index);
    }
    const tree = signalTree(state, { capabilities: ['causal-runtime'] });

    const ratio = stableRatio(
      () => {
        for (let index = 0; index < ITERATIONS; index++) {
          signals[`key_${index % 20}`]();
        }
      },
      () => {
        for (let index = 0; index < ITERATIONS; index++) {
          tree.$[`key_${index % 20}`]();
        }
      }
    );

    expect(ratio).toBeLessThan(5);
    tree.destroy();
  });

  it('write overhead is bounded (< 7x per set)', () => {
    const raw = signal(0);
    const tree = signalTree({ value: 0 }, { capabilities: ['causal-runtime'] });

    const ratio = stableRatio(
      () => {
        for (let index = 0; index < ITERATIONS; index++) raw.set(index);
      },
      () => {
        for (let index = 0; index < ITERATIONS; index++) {
          tree.$.value(index);
        }
      }
    );

    expect(ratio).toBeLessThan(7);
    tree.destroy();
  });
});
