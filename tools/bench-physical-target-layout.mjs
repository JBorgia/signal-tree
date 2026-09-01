#!/usr/bin/env node
/**
 * SUBJECT-RECORD-PROMOTION-0: value + revision physical layout competition.
 *
 * This measures only the Phase 1 physical destination. It does not promote a
 * layout into production or include lifecycle, ordering, realization, or claims.
 *
 * Usage:
 *   pnpm nx build kernel
 *   node --expose-gc tools/bench-physical-target-layout.mjs
 *   node --expose-gc tools/bench-physical-target-layout.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-physical-target-layout.mjs');

const {
  composePreparedSubjectUpdates,
  preparePhysicalSubjectSlotTarget,
  preparePhysicalSubjectTarget,
} = await import(
  pathToFileURL(
    join(
      process.cwd(),
      'packages/kernel/src/lib/physical/subject-record-target.ts'
    )
  ).href
);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const E0_VALUE_REVISION_SLOPE = 144;

const valueFor = (subjectId) => ({
  id: subjectId,
  name: `n${String(subjectId)}`,
  value: subjectId,
});

const buildContributions = (count) => {
  const structural = new Array(count);
  const values = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const subjectId = index + 1;
    structural[index] = { subjectId, revision: 0 };
    values[index] = { subjectId, value: valueFor(subjectId) };
  }
  return composePreparedSubjectUpdates(structural, values);
};

const buildIncumbent = (count) => {
  const revisions = new Map();
  const values = new Map();
  for (let index = 0; index < count; index += 1) {
    const subjectId = index + 1;
    revisions.set(subjectId, 0);
    values.set(subjectId, valueFor(subjectId));
  }
  return { revisions, values };
};

const buildObjectRecords = (count) =>
  preparePhysicalSubjectTarget(new Map(), buildContributions(count));

const buildStableSlots = (count) =>
  preparePhysicalSubjectSlotTarget(
    {
      slotBySubject: new Map(),
      subjects: [],
      revisions: [],
      values: [],
    },
    buildContributions(count)
  );

const prepareIncumbentUpdate = (current, updates) => {
  const revisions = new Map(current.revisions);
  const values = new Map(current.values);
  for (const update of updates) {
    if (update.revision !== undefined) {
      revisions.set(update.subjectId, update.revision);
    }
    if (update.value !== undefined) {
      values.set(update.subjectId, update.value);
    }
  }
  return { revisions, values };
};

const ARMS = {
  incumbent: {
    description: 'separate SubjectId revision and value Maps',
    build: buildIncumbent,
    prepare: prepareIncumbentUpdate,
  },
  'object-record': {
    description: 'one SubjectId Map of revision + value records',
    build: buildObjectRecords,
    prepare: preparePhysicalSubjectTarget,
  },
  'stable-slot': {
    description:
      'one SubjectId-to-slot Map plus subject/revision/value columns',
    build: buildStableSlots,
    prepare: preparePhysicalSubjectSlotTarget,
  },
};

const latencyArmIndex = process.argv.indexOf('--latency-arm');
if (latencyArmIndex !== -1) {
  const name = process.argv[latencyArmIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${String(name)}`);
  if (size <= 0) throw new Error('latency size must be positive');

  const current = arm.build(size);
  const subjectId = Math.ceil(size / 2);
  const updates = composePreparedSubjectUpdates(
    [{ subjectId, revision: 1 }],
    [{ subjectId, value: { ...valueFor(subjectId), value: -1 } }]
  );
  for (let iteration = 0; iteration < 3; iteration += 1) {
    arm.prepare(current, updates);
  }
  global.gc();
  const startedAt = performance.now();
  const target = arm.prepare(current, updates);
  const elapsedMs = performance.now() - startedAt;
  if (target === current) throw new Error(`${name} did not prepare off-store`);
  console.log(JSON.stringify({ arm: name, n: size, elapsedMs }));
  process.exit(0);
}

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${String(name)}`);
  const result = await measureRetained(() => arm.build(size), { label: name });
  console.log(
    JSON.stringify({
      arm: name,
      n: size,
      description: arm.description,
      retainedBytes: result.retainedBytes,
      quiesceRounds: result.quiesceRounds,
      collectable: result.collectable,
    })
  );
  process.exit(0);
}

const measureArmOnce = (name, count) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--experimental-strip-types',
      new URL(import.meta.url).pathname,
      '--arm',
      name,
      '--n',
      String(count),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const measureArm = (name, count) => {
  const samples = Array.from({ length: SAMPLES }, () =>
    measureArmOnce(name, count)
  );
  samples.sort((left, right) => left.retainedBytes - right.retainedBytes);
  return {
    ...samples[Math.floor(samples.length / 2)],
    collectable: samples.every((sample) => sample.collectable),
  };
};

const measureLatencyOnce = (name, count) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      '--experimental-strip-types',
      new URL(import.meta.url).pathname,
      '--latency-arm',
      name,
      '--n',
      String(count),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const measureLatency = (name, count) => {
  const samples = Array.from({ length: SAMPLES }, () =>
    measureLatencyOnce(name, count)
  );
  samples.sort((left, right) => left.elapsedMs - right.elapsedMs);
  return samples[Math.floor(samples.length / 2)];
};

if (process.argv.includes('--latency')) {
  const sizes = SIZES.filter((count) => count > 0);
  const latencyRows = Object.entries(ARMS).map(([name, arm]) => ({
    arm: name,
    description: arm.description,
    points: sizes.map((count) => measureLatency(name, count)),
  }));

  if (process.argv.includes('--json')) {
    console.log(
      JSON.stringify({ sizes, samples: SAMPLES, rows: latencyRows }, null, 2)
    );
    process.exit(0);
  }

  const incumbent = latencyRows.find((row) => row.arm === 'incumbent');
  console.log('\nSUBJECT-RECORD-PROMOTION-0 / prepared-target latency');
  console.log(
    `one revision + value update; ${String(
      SAMPLES
    )} isolated samples per arm and size\n`
  );
  console.log(
    'arm'.padEnd(20) + sizes.map((count) => String(count).padStart(20)).join('')
  );
  console.log('-'.repeat(80));
  for (const row of latencyRows) {
    console.log(
      row.arm.padEnd(20) +
        row.points
          .map((point, index) => {
            const baseline = incumbent.points[index].elapsedMs;
            const delta = ((point.elapsedMs - baseline) / baseline) * 100;
            return `${point.elapsedMs.toFixed(3)}ms ${
              delta >= 0 ? '+' : ''
            }${delta.toFixed(1)}%`.padStart(20);
          })
          .join('')
    );
    console.log(`  ${row.description}`);
  }
  process.exit(0);
}

const linearFit = (points) => {
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
  return {
    bytesPerEntity: numerator / denominator,
    fittedFixedBytes: meanBytes - (numerator / denominator) * meanN,
  };
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((count) => measureArm(name, count));
  return {
    ...points[0],
    description: arm.description,
    points,
    ...linearFit(points),
  };
});
const byName = new Map(rows.map((row) => [row.arm, row]));
const incumbentSlope = byName.get('incumbent').bytesPerEntity;
const problems = [];

if (
  incumbentSlope < E0_VALUE_REVISION_SLOPE * 0.9 ||
  incumbentSlope > E0_VALUE_REVISION_SLOPE * 1.1
) {
  problems.push(
    `incumbent ${incumbentSlope.toFixed(
      1
    )} B/entity does not reproduce the E0 value + revision slope ${E0_VALUE_REVISION_SLOPE.toFixed(
      1
    )} B/entity within 10%`
  );
}
for (const row of rows) {
  for (const point of row.points) {
    if (!point.collectable) {
      problems.push(`${row.arm}@${String(point.n)} did not collect`);
    }
  }
}
if (problems.length > 0) {
  throw new Error(
    `physical target layout benchmark failed:\n${problems.join('\n')}`
  );
}

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows }, null, 2)
  );
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nSUBJECT-RECORD-PROMOTION-0 / value + revision layout');
console.log(
  `retained heap after quiescence; ${String(
    SAMPLES
  )} isolated samples per arm and size\n`
);
console.log(
  'arm'.padEnd(20) +
    SIZES.map((count) => String(count).padStart(11)).join('') +
    '   B/entity   vs incumbent'
);
console.log('-'.repeat(90));
for (const row of rows) {
  console.log(
    row.arm.padEnd(20) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      row.bytesPerEntity.toFixed(1).padStart(11) +
      (row.bytesPerEntity - incumbentSlope).toFixed(1).padStart(15)
  );
  console.log(`  ${row.description}`);
}
console.log(
  '\nThis compares only value + revision physical destinations behind the shared prepared-update contract. It does not authorize production integration or select lifecycle, ordering, realization, or claim storage.'
);
