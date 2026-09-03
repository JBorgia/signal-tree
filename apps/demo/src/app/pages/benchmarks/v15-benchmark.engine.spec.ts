import {
  BenchmarkArm,
  BenchmarkWorkload,
  runInterleavedBenchmark,
  yieldToBrowserTask,
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
  it('yields to a timer task when MessageChannel is unavailable', async () => {
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);

    await expect(yieldToBrowserTask(undefined)).resolves.toBeUndefined();
    expect(timerRan).toBe(true);
  });

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
    expect(events.filter((event) => event === 'create:tree')).toHaveLength(1);
    expect(events.filter((event) => event === 'create:store')).toHaveLength(1);
    expect(events.filter((event) => event === 'dispose:tree')).toHaveLength(1);
    expect(events.filter((event) => event === 'dispose:store')).toHaveLength(1);
    expect(events.filter((event) => event.startsWith('measure:'))).toEqual([
      'measure:tree',
      'measure:store',
      'measure:store',
      'measure:tree',
      'measure:store',
      'measure:tree',
      'measure:tree',
      'measure:store',
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
      .filter((event) => event.startsWith('measure:'))
      .map((event) => event.slice('measure:'.length));
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

  it('disposes every prepared arm without masking the benchmark failure', async () => {
    const events: string[] = [];
    const brokenBase = arm('broken', 1, events, 'wrong');
    const later = arm('later', 1, events);
    const broken: BenchmarkArm = {
      ...brokenBase,
      createSample: async (currentWorkload) => {
        const sample = await brokenBase.createSample(currentWorkload);
        return {
          ...sample,
          dispose: () => {
            events.push('dispose:broken');
            throw new Error('dispose failed');
          },
        };
      },
    };

    let failure: unknown;
    try {
      await runInterleavedBenchmark({
        workload,
        arms: [broken, later],
        rounds: 1,
        warmupRounds: 0,
        settle: async () => undefined,
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      expect.objectContaining({
        message: expect.stringContaining(
          'broken/collection produced checksum "wrong"'
        ),
      }),
      expect.objectContaining({ message: 'dispose failed' }),
    ]);
    expect(events).toContain('dispose:later');
  });
});
