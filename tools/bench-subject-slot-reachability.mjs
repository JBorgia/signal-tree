#!/usr/bin/env node
/**
 * SUBJECT-SLOT-REACHABILITY-0: independent fact lifetime and high-water probe.
 *
 * Usage:
 *   node --experimental-strip-types --expose-gc \
 *     tools/bench-subject-slot-reachability.mjs
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-subject-slot-reachability.mjs');

const {
  composePreparedSubjectUpdates,
  preparePhysicalSubjectForgets,
  preparePhysicalSubjectSlotTarget,
  preparePhysicalSubjectTarget,
  preparePhysicalSubjectValueReleases,
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

const SIZE = Number(argument('--n', 100_000));
const RETIRE_COUNT = Number(argument('--retire', Math.floor(SIZE * 0.9)));
const ROUNDS = Number(argument('--rounds', 4));
const SAMPLES = Number(argument('--samples', 3));

const valueFor = (subjectId) => ({ id: subjectId, value: subjectId });

const contributionsFor = (subjectIds) =>
  composePreparedSubjectUpdates(
    subjectIds.map((subjectId) => ({ subjectId, revision: 0 })),
    subjectIds.map((subjectId) => ({ subjectId, value: valueFor(subjectId) }))
  );

const buildIncumbent = (subjectIds) => {
  const revisions = new Map();
  const values = new Map();
  for (const subjectId of subjectIds) {
    revisions.set(subjectId, 0);
    values.set(subjectId, valueFor(subjectId));
  }
  return { revisions, values };
};

const buildObjectRecords = (subjectIds) =>
  preparePhysicalSubjectTarget(new Map(), contributionsFor(subjectIds));

const buildStableSlots = (subjectIds) =>
  preparePhysicalSubjectSlotTarget(
    {
      slotBySubject: new Map(),
      subjects: [],
      revisions: [],
      values: [],
    },
    contributionsFor(subjectIds)
  );

const releaseIncumbentValues = (store, subjectIds) => {
  for (const subjectId of subjectIds) store.values.delete(subjectId);
  return store;
};

const forgetIncumbent = (store, subjectIds) => {
  for (const subjectId of subjectIds) {
    store.revisions.delete(subjectId);
    store.values.delete(subjectId);
  }
  return store;
};

const addIncumbent = (store, subjectIds) => {
  for (const subjectId of subjectIds) {
    store.revisions.set(subjectId, 0);
    store.values.set(subjectId, valueFor(subjectId));
  }
  return store;
};

const forgetObjectRecords = (store, subjectIds) => {
  for (const subjectId of subjectIds) store.delete(subjectId);
  return store;
};

const addObjectRecords = (store, subjectIds) => {
  for (const subjectId of subjectIds) {
    store.set(subjectId, { revision: 0, value: valueFor(subjectId) });
  }
  return store;
};

const statsFor = (layout, store) => {
  if (layout === 'incumbent') {
    return {
      structuralSubjects: store.revisions.size,
      valueSubjects: store.values.size,
      capacitySlots: store.revisions.size,
    };
  }
  if (layout === 'object-record') {
    return {
      structuralSubjects: store.size,
      valueSubjects: store.size,
      capacitySlots: store.size,
    };
  }
  return {
    structuralSubjects: store.slotBySubject.size,
    valueSubjects: store.values.reduce(
      (count, value) => count + (value === undefined ? 0 : 1),
      0
    ),
    capacitySlots: store.subjects.length,
  };
};

const buildFor = (layout, subjectIds) => {
  if (layout === 'incumbent') return buildIncumbent(subjectIds);
  if (layout === 'object-record') return buildObjectRecords(subjectIds);
  return buildStableSlots(subjectIds);
};

const releaseRetainedValues = (layout, store, activeSubjectIds) => {
  const retired = activeSubjectIds.slice(0, RETIRE_COUNT);
  return {
    store:
      layout === 'incumbent'
        ? releaseIncumbentValues(store, retired)
        : preparePhysicalSubjectValueReleases(store, retired),
    activeSubjectIds: activeSubjectIds.slice(RETIRE_COUNT),
  };
};

const runTerminalForgetRound = (
  layout,
  store,
  activeSubjectIds,
  nextSubjectId
) => {
  const retired = activeSubjectIds.slice(0, RETIRE_COUNT);
  const survivors = activeSubjectIds.slice(RETIRE_COUNT);
  const fresh = Array.from(
    { length: RETIRE_COUNT },
    (_, index) => nextSubjectId + index
  );

  if (layout === 'incumbent') {
    store = addIncumbent(forgetIncumbent(store, retired), fresh);
  } else if (layout === 'object-record') {
    store = addObjectRecords(forgetObjectRecords(store, retired), fresh);
  } else {
    store = preparePhysicalSubjectSlotTarget(
      preparePhysicalSubjectForgets(store, retired),
      contributionsFor(fresh)
    );
  }

  return {
    store,
    activeSubjectIds: [...survivors, ...fresh],
    nextSubjectId: nextSubjectId + RETIRE_COUNT,
  };
};

const runChild = async (scenario, layout) => {
  const baseline = await quiesce({ label: `${scenario}:${layout}:baseline` });
  let activeSubjectIds = Array.from({ length: SIZE }, (_, index) => index + 1);
  let nextSubjectId = SIZE + 1;
  let store = buildFor(layout, activeSubjectIds);
  const heldHeaps = [];
  heldHeaps.push(
    (await quiesce({ label: `${scenario}:${layout}:initial` })).heapUsed
  );

  if (scenario === 'retained-structural') {
    if (layout === 'object-record') {
      throw new Error('object records cannot represent revision without value');
    }
    ({ store, activeSubjectIds } = releaseRetainedValues(
      layout,
      store,
      activeSubjectIds
    ));
    heldHeaps.push(
      (await quiesce({ label: `${scenario}:${layout}:released-values` }))
        .heapUsed
    );
  } else {
    for (let round = 0; round < ROUNDS; round += 1) {
      ({ store, activeSubjectIds, nextSubjectId } = runTerminalForgetRound(
        layout,
        store,
        activeSubjectIds,
        nextSubjectId
      ));
      heldHeaps.push(
        (
          await quiesce({
            label: `${scenario}:${layout}:round-${String(round + 1)}`,
          })
        ).heapUsed
      );
    }
  }

  const stats = statsFor(layout, store);
  activeSubjectIds = [];
  const settled = await quiesce({ label: `${scenario}:${layout}:final` });
  heldHeaps.push(settled.heapUsed);
  const ref = new WeakRef(store);
  store = null;
  await quiesce({ label: `${scenario}:${layout}:released` });

  return {
    scenario,
    layout,
    n: SIZE,
    retireCount: RETIRE_COUNT,
    rounds: scenario === 'terminal-forget' ? ROUNDS : 0,
    peakRetainedBytes: Math.max(...heldHeaps) - baseline.heapUsed,
    postGcRetainedBytes: settled.heapUsed - baseline.heapUsed,
    collectable: ref.deref() === undefined,
    ...stats,
  };
};

const scenarioIndex = process.argv.indexOf('--scenario');
const layoutIndex = process.argv.indexOf('--layout');
if (scenarioIndex !== -1 && layoutIndex !== -1) {
  console.log(
    JSON.stringify(
      await runChild(
        process.argv[scenarioIndex + 1],
        process.argv[layoutIndex + 1]
      )
    )
  );
  process.exit(0);
}

const runOnce = (scenario, layout) => {
  const output = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--scenario',
      scenario,
      '--layout',
      layout,
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

const measure = (scenario, layout) => {
  const samples = Array.from({ length: SAMPLES }, () =>
    runOnce(scenario, layout)
  );
  samples.sort(
    (left, right) => left.postGcRetainedBytes - right.postGcRetainedBytes
  );
  const peaks = samples
    .map((sample) => sample.peakRetainedBytes)
    .sort((left, right) => left - right);
  return {
    ...samples[Math.floor(samples.length / 2)],
    peakRetainedBytes: peaks[Math.floor(peaks.length / 2)],
    collectable: samples.every((sample) => sample.collectable),
  };
};

const rows = [
  measure('retained-structural', 'incumbent'),
  measure('retained-structural', 'stable-slot'),
  measure('terminal-forget', 'incumbent'),
  measure('terminal-forget', 'object-record'),
  measure('terminal-forget', 'stable-slot'),
];
if (rows.some((row) => !row.collectable)) {
  throw new Error('subject-slot reachability owner did not collect');
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ samples: SAMPLES, rows }, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nSUBJECT-SLOT-REACHABILITY-0');
console.log(
  `${String(SAMPLES)} isolated samples; ${String(
    SIZE
  )} initial subjects; ${String(RETIRE_COUNT)} retirements per round\n`
);
console.log(
  'scenario'.padEnd(22) +
    'layout'.padEnd(17) +
    'peak'.padStart(11) +
    'post-GC'.padStart(11) +
    'structural'.padStart(12) +
    'values'.padStart(10) +
    'capacity'.padStart(11)
);
console.log('-'.repeat(94));
for (const row of rows) {
  console.log(
    row.scenario.padEnd(22) +
      row.layout.padEnd(17) +
      mb(row.peakRetainedBytes).padStart(11) +
      mb(row.postGcRetainedBytes).padStart(11) +
      String(row.structuralSubjects).padStart(12) +
      String(row.valueSubjects).padStart(10) +
      String(row.capacitySlots).padStart(11)
  );
}
console.log(
  '\nRetained-structural releases value payloads while preserving SubjectId/revision. Terminal-forget assumes external eligibility, removes both facts, and allocates fresh monotonic SubjectIds; this layout baseline does not reuse vacant physical slots.'
);
