import { signalTree as kernelSignalTree } from '@signal-tree/kernel';
import { signalTree as reactSignalTree } from '@signal-tree/react';

import { runInterleavedBenchmark } from './v15-benchmark.engine';
import { createV15BenchmarkSuites } from './v15-benchmark.workloads';

const expectedKeyedArms = [
  'signaltree-angular',
  'signaltree-kernel',
  'ngrx-signals',
  'elf',
  'akita',
  'redux-toolkit',
];

const expectedHistoryArms = [
  'signaltree-angular',
  'signaltree-kernel',
  'elf',
  'akita',
];

describe('v15 browser benchmark workloads', () => {
  it('uses the exact neutral factory exported by the React facade', () => {
    expect(reactSignalTree).toBe(kernelSignalTree);
  });

  it('uses three checked tasks across real library stores', () => {
    const suites = createV15BenchmarkSuites({
      collectionSize: 12,
      collectionUpdates: 6,
      restorationSize: 12,
      restorationWrites: 4,
    });

    expect(suites.map((suite) => suite.workload.id)).toEqual([
      'initialization',
      'collection',
      'restoration',
    ]);
    expect(suites[0].arms.map((arm) => arm.id)).toEqual(expectedKeyedArms);
    expect(suites[1].arms.map((arm) => arm.id)).toEqual(expectedKeyedArms);
    expect(suites[2].arms.map((arm) => arm.id)).toEqual(expectedHistoryArms);

    for (const suite of suites) {
      expect(Object.values(suite.calculation).every(Boolean)).toBe(true);
      expect(
        suite.arms.every((arm) => Object.values(arm.comparison).every(Boolean))
      ).toBe(true);
    }

    expect(suites[0].arms.find((arm) => arm.id === 'ngrx-signals')?.label).toBe(
      'NgRx Signals'
    );

    const restoration = suites[2];
    expect(
      restoration.arms.find((arm) => arm.id === 'signaltree-kernel')?.comparison
        .featureSource
    ).toContain('Built-in');
    expect(
      restoration.arms.find((arm) => arm.id === 'elf')?.comparison.featureSource
    ).toContain('First-party');
    expect(
      suites
        .flatMap((suite) => suite.arms)
        .some((arm) => arm.comparison.kind.startsWith('Harness'))
    ).toBe(false);
  });

  it('measures initialization as its own checked task', async () => {
    const destroyed: boolean[] = [];
    const [suite] = createV15BenchmarkSuites(
      {
        collectionSize: 12,
        collectionUpdates: 6,
        restorationSize: 12,
        restorationWrites: 4,
      },
      { onSignalTreeDestroyed: (value) => destroyed.push(value) }
    );

    const report = await runInterleavedBenchmark({
      ...suite,
      rounds: 1,
      warmupRounds: 0,
      settle: async () => undefined,
    });

    expect(report.results).toHaveLength(6);
    expect(report.results.every((result) => result.medianMs >= 0)).toBe(true);
    expect(destroyed).toEqual([true, true]);
  });

  it('seeds before measuring equivalent keyed updates and reads', async () => {
    const destroyed: boolean[] = [];
    const [, suite] = createV15BenchmarkSuites(
      {
        collectionSize: 12,
        collectionUpdates: 6,
        restorationSize: 12,
        restorationWrites: 4,
      },
      { onSignalTreeDestroyed: (value) => destroyed.push(value) }
    );

    const report = await runInterleavedBenchmark({
      ...suite,
      rounds: 1,
      warmupRounds: 0,
      settle: async () => undefined,
    });

    expect(report.results).toHaveLength(6);
    expect(report.results.every((result) => result.medianMs >= 0)).toBe(true);
    expect(destroyed).toEqual([true, true]);
  });

  it('makes every restoration arm record writes and restore the seed value', async () => {
    const destroyed: boolean[] = [];
    const [, , suite] = createV15BenchmarkSuites(
      {
        collectionSize: 12,
        collectionUpdates: 6,
        restorationSize: 12,
        restorationWrites: 4,
      },
      { onSignalTreeDestroyed: (value) => destroyed.push(value) }
    );

    const report = await runInterleavedBenchmark({
      ...suite,
      rounds: 1,
      warmupRounds: 0,
      settle: async () => undefined,
    });

    expect(report.results).toHaveLength(4);
    expect(report.results.every((result) => result.medianMs >= 0)).toBe(true);
    expect(destroyed).toEqual([true, true]);
  });
});
