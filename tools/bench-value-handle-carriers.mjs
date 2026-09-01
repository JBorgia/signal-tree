#!/usr/bin/env node
/**
 * SPLIT-POOL-PROMOTION-0: value-handle directory placement competition.
 *
 * Usage:
 *   pnpm exec tsx --expose-gc \
 *     tools/bench-value-handle-carriers.mjs
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-value-handle-carriers.mjs');

const source = (name) =>
  pathToFileURL(join(process.cwd(), 'packages/kernel/src/lib/physical', name))
    .href;
const [{ CheckedValueCarrier }, valuePool, { composePreparedSubjectUpdates }] =
  await Promise.all([
    import(source('checked-value-carrier.ts')),
    import(source('physical-value-pool.ts')),
    import(source('subject-record-target.ts')),
  ]);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZE = Number(argument('--n', 100_000));
const RETIRE_COUNT = Number(argument('--retire', Math.floor(SIZE * 0.9)));
const ROUNDS = Number(argument('--rounds', 4));
const SAMPLES = Number(argument('--samples', 5));

const valueFor = (subjectId) => ({ id: subjectId, value: subjectId });
const updatesFor = (subjectIds) =>
  composePreparedSubjectUpdates(
    subjectIds.map((subjectId) => ({ subjectId, revision: 0 })),
    subjectIds.map((subjectId) => ({ subjectId, value: valueFor(subjectId) }))
  );

const buildIncumbent = (subjectIds) => ({
  revisions: new Map(subjectIds.map((subjectId) => [subjectId, 0])),
  values: new Map(
    subjectIds.map((subjectId) => [subjectId, valueFor(subjectId)])
  ),
});

const buildSplitPool = (subjectIds) => ({
  revisions: new Map(subjectIds.map((subjectId) => [subjectId, 0])),
  pool: valuePool.preparePhysicalValueTarget(
    valuePool.emptyPhysicalValuePool(),
    updatesFor(subjectIds)
  ),
});

const buildCheckedCarrier = (subjectIds) =>
  new CheckedValueCarrier().prepare(updatesFor(subjectIds));

const buildFor = (carrier, subjectIds) => {
  if (carrier === 'incumbent') return buildIncumbent(subjectIds);
  if (carrier === 'split-pool') return buildSplitPool(subjectIds);
  return buildCheckedCarrier(subjectIds);
};

const releaseValues = (carrier, store, subjectIds) => {
  if (carrier === 'incumbent') {
    const values = new Map(store.values);
    for (const subjectId of subjectIds) values.delete(subjectId);
    return { revisions: store.revisions, values };
  }
  if (carrier === 'split-pool') {
    return {
      revisions: store.revisions,
      pool: valuePool.preparePhysicalValueRelease(store.pool, subjectIds),
    };
  }
  return store.prepareValueRelease(subjectIds);
};

const forgetAndAdd = (carrier, store, retired, fresh) => {
  if (carrier === 'incumbent') {
    const revisions = new Map(store.revisions);
    const values = new Map(store.values);
    for (const subjectId of retired) {
      revisions.delete(subjectId);
      values.delete(subjectId);
    }
    for (const subjectId of fresh) {
      revisions.set(subjectId, 0);
      values.set(subjectId, valueFor(subjectId));
    }
    return { revisions, values };
  }
  if (carrier === 'split-pool') {
    const revisions = new Map(store.revisions);
    for (const subjectId of retired) revisions.delete(subjectId);
    for (const subjectId of fresh) revisions.set(subjectId, 0);
    return {
      revisions,
      pool: valuePool.preparePhysicalValueTarget(
        valuePool.preparePhysicalValueRelease(store.pool, retired),
        updatesFor(fresh)
      ),
    };
  }
  return store.prepareTerminalForget(retired).prepare(updatesFor(fresh));
};

const statsFor = (carrier, store) => {
  if (carrier === 'incumbent') {
    return {
      structuralSubjects: store.revisions.size,
      valueSubjects: store.values.size,
      valueAddressUnits: store.values.size,
    };
  }
  if (carrier === 'split-pool') {
    return {
      structuralSubjects: store.revisions.size,
      valueSubjects: store.pool.handlesBySubject.size,
      valueAddressUnits: store.pool.values.length,
    };
  }
  return {
    structuralSubjects: store.structuralSubjectCount(),
    valueSubjects: store.valueSubjectCount(),
    valueAddressUnits: store.valueCapacity(),
  };
};

const runTransition = (
  scenario,
  carrier,
  store,
  activeSubjectIds,
  nextSubjectId
) => {
  if (scenario === 'dense-active') {
    return { store, activeSubjectIds, nextSubjectId };
  }
  const retired = activeSubjectIds.slice(0, RETIRE_COUNT);
  const survivors = activeSubjectIds.slice(RETIRE_COUNT);
  if (scenario === 'retained-structural') {
    return {
      store: releaseValues(carrier, store, retired),
      activeSubjectIds: survivors,
      nextSubjectId,
    };
  }
  const fresh = Array.from(
    { length: RETIRE_COUNT },
    (_, index) => nextSubjectId + index
  );
  return {
    store: forgetAndAdd(carrier, store, retired, fresh),
    activeSubjectIds: [...survivors, ...fresh],
    nextSubjectId: nextSubjectId + RETIRE_COUNT,
  };
};

const runChild = async (scenario, carrier) => {
  const baseline = await quiesce({ label: `${scenario}:${carrier}:baseline` });
  let activeSubjectIds = Array.from({ length: SIZE }, (_, index) => index + 1);
  let nextSubjectId = SIZE + 1;
  let store = buildFor(carrier, activeSubjectIds);
  const heaps = [
    (await quiesce({ label: `${scenario}:${carrier}:initial` })).heapUsed,
  ];
  const rounds =
    scenario === 'terminal-forget'
      ? ROUNDS
      : scenario === 'dense-active'
      ? 0
      : 1;
  for (let round = 0; round < rounds; round += 1) {
    ({ store, activeSubjectIds, nextSubjectId } = runTransition(
      scenario,
      carrier,
      store,
      activeSubjectIds,
      nextSubjectId
    ));
    heaps.push(
      (
        await quiesce({
          label: `${scenario}:${carrier}:round-${String(round + 1)}`,
        })
      ).heapUsed
    );
  }
  const stats = statsFor(carrier, store);
  activeSubjectIds = [];
  const settled = await quiesce({ label: `${scenario}:${carrier}:final` });
  const ref = new WeakRef(store);
  store = null;
  await quiesce({ label: `${scenario}:${carrier}:released` });
  return {
    scenario,
    carrier,
    peakRetainedBytes: Math.max(...heaps, settled.heapUsed) - baseline.heapUsed,
    postGcRetainedBytes: settled.heapUsed - baseline.heapUsed,
    collectable: ref.deref() === undefined,
    ...stats,
  };
};

const scenarioIndex = process.argv.indexOf('--scenario');
const carrierIndex = process.argv.indexOf('--carrier');
if (scenarioIndex !== -1 && carrierIndex !== -1) {
  console.log(
    JSON.stringify(
      await runChild(
        process.argv[scenarioIndex + 1],
        process.argv[carrierIndex + 1]
      )
    )
  );
  process.exit(0);
}

const runOnce = (scenario, carrier) => {
  const output = execFileSync(
    'pnpm',
    [
      'exec',
      'tsx',
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--scenario',
      scenario,
      '--carrier',
      carrier,
      '--n',
      String(SIZE),
      '--retire',
      String(RETIRE_COUNT),
      '--rounds',
      String(ROUNDS),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 240_000,
    }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const measure = (scenario, carrier) => {
  const samples = Array.from({ length: SAMPLES }, () =>
    runOnce(scenario, carrier)
  );
  const byPostGc = [...samples].sort(
    (left, right) => left.postGcRetainedBytes - right.postGcRetainedBytes
  );
  const peaks = samples
    .map((sample) => sample.peakRetainedBytes)
    .sort((left, right) => left - right);
  return {
    ...byPostGc[Math.floor(byPostGc.length / 2)],
    peakRetainedBytes: peaks[Math.floor(peaks.length / 2)],
    collectable: samples.every((sample) => sample.collectable),
  };
};

const scenarios = ['dense-active', 'retained-structural', 'terminal-forget'];
const carriers = ['incumbent', 'split-pool', 'checked-carrier'];
const rows = scenarios.flatMap((scenario) =>
  carriers.map((carrier) => measure(scenario, carrier))
);
if (rows.some((row) => !row.collectable)) {
  throw new Error('value-handle carrier owner did not collect');
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ samples: SAMPLES, rows }, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nSPLIT-POOL-PROMOTION-0 / value-handle carriers');
console.log(
  `${String(SAMPLES)} isolated samples; ${String(
    SIZE
  )} initial subjects; ${String(RETIRE_COUNT)} releases per round\n`
);
console.log(
  'scenario'.padEnd(22) +
    'carrier'.padEnd(18) +
    'peak'.padStart(11) +
    'post-GC'.padStart(11) +
    'structural'.padStart(12) +
    'values'.padStart(10) +
    'addr units'.padStart(11)
);
console.log('-'.repeat(95));
for (const row of rows) {
  console.log(
    row.scenario.padEnd(22) +
      row.carrier.padEnd(18) +
      mb(row.peakRetainedBytes).padStart(11) +
      mb(row.postGcRetainedBytes).padStart(11) +
      String(row.structuralSubjects).padStart(12) +
      String(row.valueSubjects).padStart(10) +
      String(row.valueAddressUnits).padStart(11)
  );
}
console.log(
  '\nAll carriers preserve independent structural/value cardinality and prepare off-store targets. Address units mean live Map entries for the incumbent and allocated value-array slots for pool carriers; they are logical address counts, not comparable engine-internal container capacity. Both pool carriers reuse value slots without reusing SubjectIds.'
);
