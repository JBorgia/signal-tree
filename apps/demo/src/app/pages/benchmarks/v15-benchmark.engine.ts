export type BenchmarkWorkloadId =
  | 'scalar'
  | 'collection'
  | 'projection'
  | 'restoration';

export interface BenchmarkWorkload {
  readonly id: BenchmarkWorkloadId;
  readonly title: string;
  readonly description: string;
  readonly operations: number;
  readonly expectedChecksum: string;
}

export interface BenchmarkMeasurement {
  readonly durationMs: number;
  readonly operations: number;
  readonly phases?: Readonly<Record<string, number>>;
}

export interface PreparedBenchmarkSample {
  readonly measure: () => BenchmarkMeasurement | Promise<BenchmarkMeasurement>;
  readonly checksum: () => string;
  readonly dispose: () => void;
}

export interface BenchmarkArm {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly description?: string;
  readonly createSample: (
    workload: BenchmarkWorkload
  ) => PreparedBenchmarkSample | Promise<PreparedBenchmarkSample>;
}

export interface BenchmarkArmResult {
  readonly armId: string;
  readonly label: string;
  readonly color: string;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly spreadMs: number;
  readonly microsecondsPerOperation: number;
  readonly samples: readonly number[];
  readonly phases: readonly BenchmarkPhaseResult[];
}

export interface BenchmarkPhaseResult {
  readonly id: string;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
}

export interface BenchmarkReport {
  readonly workload: BenchmarkWorkload;
  readonly rounds: number;
  readonly warmupRounds: number;
  readonly results: readonly BenchmarkArmResult[];
}

export interface RunInterleavedBenchmarkOptions {
  readonly workload: BenchmarkWorkload;
  readonly arms: readonly BenchmarkArm[];
  readonly rounds?: number;
  readonly warmupRounds?: number;
  readonly settle?: () => Promise<void>;
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const spread = (values: readonly number[]): number =>
  Math.max(...values) - Math.min(...values);

export const yieldToBrowserTask = (
  MessageChannelType:
    | typeof MessageChannel
    | undefined = globalThis.MessageChannel
): Promise<void> => {
  if (!MessageChannelType) {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  return new Promise((resolve) => {
    const channel = new MessageChannelType();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
};

const defaultSettle = (): Promise<void> => yieldToBrowserTask();

export const runInterleavedBenchmark = async ({
  workload,
  arms,
  rounds = 25,
  warmupRounds = 2,
  settle = defaultSettle,
}: RunInterleavedBenchmarkOptions): Promise<BenchmarkReport> => {
  if (arms.length === 0)
    throw new Error('At least one benchmark arm is required');
  if (!Number.isInteger(rounds) || rounds < 1) {
    throw new Error('Benchmark rounds must be a positive integer');
  }
  if (!Number.isInteger(warmupRounds) || warmupRounds < 0) {
    throw new Error('Benchmark warmup rounds must be a non-negative integer');
  }
  if (!Number.isInteger(workload.operations) || workload.operations < 1) {
    throw new Error(`${workload.id} must declare a positive operation count`);
  }

  const samplesByArm = new Map(
    arms.map((currentArm) => [currentArm.id, [] as number[]])
  );
  const phaseSamplesByArm = new Map(
    arms.map((currentArm) => [currentArm.id, new Map<string, number[]>()])
  );
  const totalRounds = warmupRounds + rounds;
  const preparedSamples = new Map<string, PreparedBenchmarkSample>();
  let benchmarkFailed = false;
  let benchmarkFailure: unknown;

  try {
    for (const currentArm of arms) {
      preparedSamples.set(
        currentArm.id,
        await currentArm.createSample(workload)
      );
    }

    for (let round = 0; round < totalRounds; round += 1) {
      await settle();
      const offset = Math.floor(round / 2) % arms.length;
      const rotatedArms = [...arms.slice(offset), ...arms.slice(0, offset)];
      const orderedArms =
        round % 2 === 0 ? rotatedArms : [...rotatedArms].reverse();

      for (const currentArm of orderedArms) {
        const sample = preparedSamples.get(currentArm.id);
        if (!sample) {
          throw new Error(
            `${currentArm.id} did not prepare a benchmark sample`
          );
        }
        const measurement: BenchmarkMeasurement = await sample.measure();
        if (
          !Number.isFinite(measurement.durationMs) ||
          measurement.durationMs < 0 ||
          measurement.operations !== workload.operations
        ) {
          throw new Error(
            `${currentArm.id}/${workload.id} returned an invalid measurement`
          );
        }
        for (const [phaseId, durationMs] of Object.entries(
          measurement.phases ?? {}
        )) {
          if (!Number.isFinite(durationMs) || durationMs < 0) {
            throw new Error(
              `${currentArm.id}/${workload.id}/${phaseId} returned an invalid measurement`
            );
          }
        }

        const checksum = sample.checksum();
        if (checksum !== workload.expectedChecksum) {
          throw new Error(
            `${currentArm.id}/${workload.id} produced checksum "${checksum}"; ` +
              `expected "${workload.expectedChecksum}"`
          );
        }

        if (round >= warmupRounds) {
          samplesByArm.get(currentArm.id)?.push(measurement.durationMs);
          const phaseSamples = phaseSamplesByArm.get(currentArm.id);
          for (const [phaseId, durationMs] of Object.entries(
            measurement.phases ?? {}
          )) {
            const samples = phaseSamples?.get(phaseId) ?? [];
            samples.push(durationMs);
            phaseSamples?.set(phaseId, samples);
          }
        }
      }
    }
  } catch (error) {
    benchmarkFailed = true;
    benchmarkFailure = error;
  }

  const disposalFailures: unknown[] = [];
  for (const sample of preparedSamples.values()) {
    try {
      sample.dispose();
    } catch (error) {
      disposalFailures.push(error);
    }
  }

  if (benchmarkFailed) {
    if (disposalFailures.length === 0) throw benchmarkFailure;
    throw new AggregateError(
      [benchmarkFailure, ...disposalFailures],
      'Benchmark execution and sample disposal failed'
    );
  }
  if (disposalFailures.length > 0) {
    throw new AggregateError(
      disposalFailures,
      'Benchmark sample disposal failed'
    );
  }

  return {
    workload,
    rounds,
    warmupRounds,
    results: arms.map((currentArm) => {
      const samples = samplesByArm.get(currentArm.id) ?? [];
      const medianMs = median(samples);
      const phaseSamples = phaseSamplesByArm.get(currentArm.id) ?? new Map();

      return {
        armId: currentArm.id,
        label: currentArm.label,
        color: currentArm.color,
        medianMs,
        minMs: Math.min(...samples),
        maxMs: Math.max(...samples),
        spreadMs: spread(samples),
        microsecondsPerOperation: (medianMs * 1000) / workload.operations,
        samples,
        phases: [...phaseSamples.entries()].map(([id, values]) => ({
          id,
          medianMs: median(values),
          minMs: Math.min(...values),
          maxMs: Math.max(...values),
        })),
      };
    }),
  };
};
