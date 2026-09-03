import {
  BenchmarkArm,
  BenchmarkWorkload,
  runInterleavedBenchmark,
} from './v15-benchmark.engine';

const workload: BenchmarkWorkload = {
  id: 'collection',
  title: 'Keyed collection update',
  description: 'Updates one record and reads the final record.',
  operations: 5,
  expectedChecksum: 'record-4',
};

const arm = (
  id: string,
  durationMs: number,
  events: string[],
  checksum = workload.expectedChecksum
): BenchmarkArm => ({
  id,
  label: id,
  color: '#000000',
  createSample: async () => {
    events.push(`create:${id}`);
    return {
      measure: () => {
        events.push(`measure:${id}`);
        return { durationMs, operations: workload.operations };
      },
      checksum: () => checksum,
      dispose: () => events.push(`dispose:${id}`),
    };
  },
});

describe('v15 browser benchmark engine', () => {
  it('interleaves arms, discards warmup, and reports median plus spread', async () => {
    const events: string[] = [];

    const report = await runInterleavedBenchmark({
      workload,
      arms: [arm('tree', 2, events), arm('store', 5, events)],
      rounds: 3,
      warmupRounds: 1,
      settle: async () => events.push('settle'),
    });

    expect(report.results).toEqual([
      expect.objectContaining({
        armId: 'tree',
        medianMs: 2,
        minMs: 2,
        maxMs: 2,
        spreadMs: 0,
        microsecondsPerOperation: 400,
        samples: [2, 2, 2],
      }),
      expect.objectContaining({
        armId: 'store',
        medianMs: 5,
        minMs: 5,
        maxMs: 5,
        spreadMs: 0,
        microsecondsPerOperation: 1000,
        samples: [5, 5, 5],
      }),
    ]);
    expect(events.filter((event) => event === 'settle')).toHaveLength(4);
    expect(events.slice(1, 7)).toEqual([
      'create:tree',
      'measure:tree',
      'dispose:tree',
      'create:store',
      'measure:store',
      'dispose:store',
    ]);
    expect(events.slice(8, 14)).toEqual([
      'create:store',
      'measure:store',
      'dispose:store',
      'create:tree',
      'measure:tree',
      'dispose:tree',
    ]);
  });

  it('rejects an arm whose timed work does not reach the expected state', async () => {
    const events: string[] = [];

    await expect(
      runInterleavedBenchmark({
        workload,
        arms: [arm('no-op', 0.01, events, 'unchanged')],
        rounds: 1,
        warmupRounds: 0,
        settle: async () => undefined,
      })
    ).rejects.toThrow(
      'no-op/collection produced checksum "unchanged"; expected "record-4"'
    );
    expect(events).toContain('dispose:no-op');
  });

  it('rotates arm positions while reversing direction between rounds', async () => {
    const events: string[] = [];

    await runInterleavedBenchmark({
      workload,
      arms: [arm('a', 1, events), arm('b', 1, events), arm('c', 1, events)],
      rounds: 5,
      warmupRounds: 0,
      settle: async () => events.push('settle'),
    });

    const order = events
      .filter((event) => event.startsWith('create:'))
      .map((event) => event.slice('create:'.length));
    expect(order).toEqual([
      'a',
      'b',
      'c',
      'c',
      'b',
      'a',
      'b',
      'c',
      'a',
      'a',
      'c',
      'b',
      'c',
      'a',
      'b',
    ]);
  });

  it('rejects missing and non-finite measurements', async () => {
    const events: string[] = [];
    const invalid: BenchmarkArm = {
      id: 'invalid',
      label: 'Invalid',
      color: '#000000',
      createSample: async () => ({
        measure: () => ({ durationMs: Number.NaN, operations: 0 }),
        checksum: () => workload.expectedChecksum,
        dispose: () => events.push('disposed'),
      }),
    };

    await expect(
      runInterleavedBenchmark({
        workload,
        arms: [invalid],
        rounds: 1,
        warmupRounds: 0,
        settle: async () => undefined,
      })
    ).rejects.toThrow('invalid/collection returned an invalid measurement');
    expect(events).toEqual(['disposed']);
  });
});
