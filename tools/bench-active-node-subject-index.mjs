#!/usr/bin/env node
/**
 * ACTIVE-NODE-SUBJECT-INDEX-0: exact-shape index ablation and lookup latency.
 *
 * Usage:
 *   node --expose-gc tools/bench-active-node-subject-index.mjs
 */
import { execFileSync } from 'node:child_process';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-active-node-subject-index.mjs');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const MEMORY_SAMPLES = Number(argument('--memory-samples', 5));
const LATENCY_SAMPLES = Number(argument('--latency-samples', 9));
const size = Number(argument('--n', 100_000));
const LOOKUP_ROUNDS = Number(argument('--lookup-rounds', 20));
const E0_SUBJECT_INDEX_SLOPE = 36;

const buildStructuralShape = (count, omittedIndex) => {
  const subjectIds = new Map();
  const subjectStates = new Map();
  const subjectRevisions = new Map();
  const activeNodesByKey = omittedIndex === 'key' ? undefined : new Map();
  const activeNodesBySubject =
    omittedIndex === 'subject' ? undefined : new Map();
  let activeHead;
  let activeTail;

  for (let index = 0; index < count; index += 1) {
    const subjectId = index + 1;
    const node = {
      key: index,
      subjectId,
      prev: activeTail,
      next: undefined,
    };
    if (activeTail === undefined) activeHead = node;
    else activeTail.next = node;
    activeTail = node;
    subjectIds.set(index, subjectId);
    subjectStates.set(subjectId, {
      active: true,
      key: index,
      restoreAllowed: true,
    });
    subjectRevisions.set(subjectId, 0);
    activeNodesByKey?.set(index, node);
    activeNodesBySubject?.set(subjectId, node);
  }

  return {
    subjectIds,
    subjectStates,
    subjectRevisions,
    activeNodesByKey,
    activeNodesBySubject,
    activeHead,
    activeTail,
    activeCount: count,
    nextSubjectId: count + 1,
    collectionIncarnation: 0,
  };
};

const memoryArmIndex = process.argv.indexOf('--memory-arm');
if (memoryArmIndex !== -1) {
  const arm = process.argv[memoryArmIndex + 1];
  const omittedIndex =
    arm === 'derived-subject'
      ? 'subject'
      : arm === 'derived-key'
      ? 'key'
      : undefined;
  if (arm !== 'both-indexes' && omittedIndex === undefined) {
    throw new Error(`unknown memory arm: ${String(arm)}`);
  }
  const result = await measureRetained(
    () => buildStructuralShape(size, omittedIndex),
    { label: arm }
  );
  console.log(
    JSON.stringify({
      arm,
      n: size,
      retainedBytes: result.retainedBytes,
      collectable: result.collectable,
    })
  );
  process.exit(0);
}

const latencyArmIndex = process.argv.indexOf('--latency-arm');
if (latencyArmIndex !== -1) {
  const arm = process.argv[latencyArmIndex + 1];
  if (!['direct', 'derived', 'key-direct', 'key-derived'].includes(arm)) {
    throw new Error(`unknown latency arm: ${String(arm)}`);
  }
  if (size <= 0) throw new Error('latency size must be positive');
  const store = buildStructuralShape(size);
  const lookup =
    arm === 'direct'
      ? (subjectId) => store.activeNodesBySubject.get(subjectId)
      : arm === 'derived'
      ? (subjectId) => {
          const state = store.subjectStates.get(subjectId);
          if (!state?.active || state.key === undefined) return undefined;
          const node = store.activeNodesByKey.get(state.key);
          return node?.subjectId === subjectId ? node : undefined;
        }
      : arm === 'key-direct'
      ? (key) => store.activeNodesByKey.get(key)
      : (key) => {
          const subjectId = store.subjectIds.get(key);
          if (subjectId === undefined) return undefined;
          const node = store.activeNodesBySubject.get(subjectId);
          return node?.key === key ? node : undefined;
        };

  let checksum = 0;
  const run = () => {
    for (let round = 0; round < LOOKUP_ROUNDS; round += 1) {
      for (let index = 0; index < size; index += 1) {
        const address = arm.startsWith('key-') ? index : index + 1;
        checksum += lookup(address)?.subjectId ?? 0;
      }
    }
  };
  run();
  const startedAt = process.hrtime.bigint();
  run();
  const elapsedNs = Number(process.hrtime.bigint() - startedAt);
  const expectedChecksum = ((size * (size + 1)) / 2) * LOOKUP_ROUNDS * 2;
  if (checksum !== expectedChecksum) {
    throw new Error(
      `${arm} lookup checksum ${String(checksum)} did not match ${String(
        expectedChecksum
      )}`
    );
  }
  console.log(
    JSON.stringify({
      arm,
      n: size,
      lookups: size * LOOKUP_ROUNDS,
      elapsedNs,
      nsPerLookup: elapsedNs / (size * LOOKUP_ROUNDS),
    })
  );
  process.exit(0);
}

const runChild = (args) => {
  const output = execFileSync(
    process.execPath,
    ['--expose-gc', new URL(import.meta.url).pathname, ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const measureMemory = (arm, count) => {
  const samples = Array.from({ length: MEMORY_SAMPLES }, () =>
    runChild(['--memory-arm', arm, '--n', String(count)])
  );
  return {
    arm,
    n: count,
    retainedBytes: median(samples.map((sample) => sample.retainedBytes)),
    collectable: samples.every((sample) => sample.collectable),
  };
};

const linearSlope = (points) => {
  const used = points.filter((point) => point.n > 0);
  const meanN = used.reduce((sum, point) => sum + point.n, 0) / used.length;
  const meanBytes =
    used.reduce((sum, point) => sum + point.retainedBytes, 0) / used.length;
  const numerator = used.reduce(
    (sum, point) => sum + (point.n - meanN) * (point.retainedBytes - meanBytes),
    0
  );
  const denominator = used.reduce(
    (sum, point) => sum + (point.n - meanN) ** 2,
    0
  );
  return numerator / denominator;
};

const memoryRows = ['both-indexes', 'derived-subject', 'derived-key'].map(
  (arm) => {
    const points = SIZES.map((count) => measureMemory(arm, count));
    return { arm, points, bytesPerEntity: linearSlope(points) };
  }
);
if (memoryRows.some((row) => row.points.some((point) => !point.collectable))) {
  throw new Error('active-node subject-index memory owner did not collect');
}
const savedBytesPerEntity =
  memoryRows[0].bytesPerEntity - memoryRows[1].bytesPerEntity;
const keySavedBytesPerEntity =
  memoryRows[0].bytesPerEntity - memoryRows[2].bytesPerEntity;
if (
  savedBytesPerEntity < E0_SUBJECT_INDEX_SLOPE * 0.9 ||
  savedBytesPerEntity > E0_SUBJECT_INDEX_SLOPE * 1.1
) {
  throw new Error(
    `subject index ablation ${savedBytesPerEntity.toFixed(
      1
    )} B/entity does not reproduce E0 ${E0_SUBJECT_INDEX_SLOPE.toFixed(
      1
    )} B/entity within 10%`
  );
}
if (
  keySavedBytesPerEntity < E0_SUBJECT_INDEX_SLOPE * 0.9 ||
  keySavedBytesPerEntity > E0_SUBJECT_INDEX_SLOPE * 1.1
) {
  throw new Error(
    `key index ablation ${keySavedBytesPerEntity.toFixed(
      1
    )} B/entity does not reproduce E0 ${E0_SUBJECT_INDEX_SLOPE.toFixed(
      1
    )} B/entity within 10%`
  );
}

const measureLatencyPair = (arms) => {
  const samplesByArm = new Map(arms.map((arm) => [arm, []]));
  for (let sample = 0; sample < LATENCY_SAMPLES; sample += 1) {
    const orderedArms = sample % 2 === 0 ? arms : [...arms].reverse();
    for (const arm of orderedArms) {
      samplesByArm
        .get(arm)
        .push(
          runChild([
            '--latency-arm',
            arm,
            '--n',
            String(size),
            '--lookup-rounds',
            String(LOOKUP_ROUNDS),
          ])
        );
    }
  }
  return arms.map((arm) => ({
    arm,
    nsPerLookup: median(
      samplesByArm.get(arm).map((sample) => sample.nsPerLookup)
    ),
  }));
};

const latencyRows = measureLatencyPair(['direct', 'derived']);
const keyLatencyRows = measureLatencyPair(['key-direct', 'key-derived']);
const latencyDelta =
  ((latencyRows[1].nsPerLookup - latencyRows[0].nsPerLookup) /
    latencyRows[0].nsPerLookup) *
  100;

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        memorySamples: MEMORY_SAMPLES,
        latencySamples: LATENCY_SAMPLES,
        memoryRows,
        savedBytesPerEntity,
        keySavedBytesPerEntity,
        latencyRows,
        latencyDelta,
        keyLatencyRows,
      },
      null,
      2
    )
  );
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nACTIVE-NODE-SUBJECT-INDEX-0');
console.log(
  `${String(MEMORY_SAMPLES)} isolated memory samples; ${String(
    LATENCY_SAMPLES
  )} isolated latency samples\n`
);
console.log(
  'memory arm'.padEnd(20) + '100k'.padStart(12) + 'B/entity'.padStart(13)
);
console.log('-'.repeat(45));
for (const row of memoryRows) {
  console.log(
    row.arm.padEnd(20) +
      mb(row.points.at(-1).retainedBytes).padStart(12) +
      row.bytesPerEntity.toFixed(1).padStart(13)
  );
}
console.log(
  `\nsubject index saving: ${savedBytesPerEntity.toFixed(1)} B/entity`
);
console.log(`key index saving: ${keySavedBytesPerEntity.toFixed(1)} B/entity`);
console.log(
  '\nlookup arm'.padEnd(20) +
    'ns/lookup'.padStart(14) +
    'vs direct'.padStart(14)
);
console.log('-'.repeat(48));
for (const row of latencyRows) {
  const delta =
    ((row.nsPerLookup - latencyRows[0].nsPerLookup) /
      latencyRows[0].nsPerLookup) *
    100;
  console.log(
    row.arm.padEnd(20) +
      row.nsPerLookup.toFixed(1).padStart(14) +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`.padStart(14)
  );
}
console.log(
  '\nkey lookup arm'.padEnd(20) +
    'ns/lookup'.padStart(14) +
    'vs direct'.padStart(14)
);
console.log('-'.repeat(48));
for (const row of keyLatencyRows) {
  const delta =
    ((row.nsPerLookup - keyLatencyRows[0].nsPerLookup) /
      keyLatencyRows[0].nsPerLookup) *
    100;
  console.log(
    row.arm.padEnd(20) +
      row.nsPerLookup.toFixed(1).padStart(14) +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`.padStart(14)
  );
}
console.log(
  '\nEach memory arm removes one active-node index from E0 exact structural shapes. Derived lookups traverse the surviving identity index and require a final key or SubjectId identity guard.'
);
