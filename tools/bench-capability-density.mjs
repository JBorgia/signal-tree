#!/usr/bin/env node
/**
 * ENTITY-PHYSICAL-DENSITY-0 / E5: production capability/history density.
 *
 * Restoration is measured separately from physical storage and realization.
 * Each arm uses the public production API; internal claim inventory is read
 * without materializing entity facades. Positive `maxHistorySize` is the number
 * of completed designated turns retained; zero retains none.
 *
 * Usage:
 *   node --expose-gc tools/bench-capability-density.mjs
 *   node --expose-gc tools/bench-capability-density.mjs --samples 1
 *   node --expose-gc tools/bench-capability-density.mjs --json
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-capability-density.mjs');

const DIST = join(process.cwd(), 'dist/packages/kernel/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const [
  { entityMap, restoration, signalTree, undoable },
  { getSubjectRestorationClaims },
  { getTreeRealizationDescriptors },
] = await Promise.all([
  import(`${DIST}/index.js`),
  import(`${DIST}/lib/internals/subject-restoration-claims.js`),
  import(`${DIST}/lib/internals/causal-runtime/tree-realization-adapter.js`),
]);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const DESIGNATED_WRITES = Number(argument('--designated-writes', 100));
const UNDESIGNATED_WRITES = Number(argument('--undesignated-writes', 1_000));
for (const [name, value] of [
  ['n', size],
  ['samples', SAMPLES],
  ['designated-writes', DESIGNATED_WRITES],
  ['undesignated-writes', UNDESIGNATED_WRITES],
]) {
  if (!Number.isSafeInteger(value) || value < (name === 'samples' ? 1 : 0)) {
    throw new RangeError(`${name} must be a ${name === 'samples' ? 'positive' : 'non-negative'} safe integer`);
  }
}

const seed = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    name: `n${index}`,
    value: index,
  }));

const createTree = async (count, maxHistorySize, causalOnly = false) => {
  const initial = {
    counter: 0,
    rows: entityMap({ selectId: (row) => row.id }),
  };
  const tree = maxHistorySize === undefined && !causalOnly
    ? signalTree(initial)
    : signalTree(initial, causalOnly
      ? { capabilities: ['causal-runtime'] }
      : {
        enhancers: [restoration({ maxHistorySize })],
        capabilities: ['causal-runtime'],
      });
  tree.$.rows.setAll(seed(count));
  await settle('initial-population');
  return tree;
};

const settle = async (label) => {
  await quiesce({ label });
};

const ordinaryWrites = (tree, count, writes) => {
  for (let index = 0; index < writes; index++) {
    if (count === 0) tree.$.counter.set(index + 1);
    else tree.$.rows.updateOne(index % count, { value: index + 1 });
  }
};

const designatedWrites = async (tree, count, writes) => {
  for (let index = 0; index < writes; index++) {
    undoable(() => {
      if (count === 0) tree.$.counter.set(index + 1);
      else tree.$.rows.updateOne(index % count, { value: index + 1 });
    });
    await Promise.resolve();
    await Promise.resolve();
  }
};

const designatedScalarWrites = async (tree, writes) => {
  for (let index = 0; index < writes; index++) {
    undoable(() => tree.$.counter.set(index + 1));
    await Promise.resolve();
    await Promise.resolve();
  }
};

const inspectCapability = (tree) => {
  const descriptors =
    getTreeRealizationDescriptors(tree) ??
    getTreeRealizationDescriptors(tree.$) ??
    new Map();
  let subjectDescriptors = 0;
  let structuralEffects = 0;
  for (const descriptor of descriptors.values()) {
    subjectDescriptors += descriptor.subjectDescriptors?.size ?? 0;
    structuralEffects += descriptor.structuralEffectBySubject?.size ?? 0;
  }
  if (typeof tree.getRestorationHistory !== 'function') {
    return {
      historyEntries: 0,
      undoSteps: 0,
      claimOwners: 0,
      claimedSubjects: 0,
      descriptorOwners: descriptors.size,
      subjectDescriptors,
      structuralEffects,
    };
  }
  const history = tree.__restoration?.history ?? [];
  const claims = getSubjectRestorationClaims(tree)?.snapshot() ?? {
    owners: 0,
    claimedSubjects: 0,
  };
  const union = new Set(
    history.flatMap((entry) => entry.restorationSubjectIds ?? [])
  );
  if (union.size !== claims.claimedSubjects) {
    throw new Error(
      `claim/history mismatch: ${String(claims.claimedSubjects)} vs ${String(union.size)}`
    );
  }
  return {
    historyEntries: history.length,
    undoSteps: history.length,
    claimOwners: claims.owners,
    claimedSubjects: claims.claimedSubjects,
    descriptorOwners: descriptors.size,
    subjectDescriptors,
    structuralEffects,
  };
};

const measureCapabilityRetained = async (build, label) => {
  const start = await quiesce({ label: `${label} (baseline)` });
  let tree = await build();
  const settled = await quiesce({ label: `${label} (held)` });
  const ref = new WeakRef(tree);
  let claims = getSubjectRestorationClaims(tree);
  let descriptors =
    getTreeRealizationDescriptors(tree) ??
    getTreeRealizationDescriptors(tree.$);
  const claimsRef = claims === undefined ? undefined : new WeakRef(claims);
  const descriptorsRef =
    descriptors === undefined ? undefined : new WeakRef(descriptors);
  tree.destroy();
  tree = null;
  claims = undefined;
  descriptors = undefined;
  await quiesce({ label: `${label} (destroyed)` });
  return {
    retainedBytes: settled.heapUsed - start.heapUsed,
    collectable: ref.deref() === undefined,
    claimRegistryCollectable:
      claimsRef === undefined || claimsRef.deref() === undefined,
    descriptorStoreCollectable:
      descriptorsRef === undefined || descriptorsRef.deref() === undefined,
    quiesceRounds: settled.rounds,
  };
};

const ARMS = {
  raw: {
    description: 'no restoration capability',
    build: async (count) => createTree(count),
  },
  'causal-runtime-only': {
    description: 'causal-runtime capability without restoration enhancer',
    build: async (count) => createTree(count, undefined, true),
  },
  'configured-unused': {
    description: 'restoration configured; zero designated writes',
    build: async (count) => createTree(count, 20),
  },
  'configured-undesignated': {
    description: `${UNDESIGNATED_WRITES} ordinary undesignated writes`,
    build: async (count) => {
      const tree = await createTree(count, 20);
      ordinaryWrites(tree, count, UNDESIGNATED_WRITES);
      await settle('configured-undesignated-workload');
      return tree;
    },
  },
  'requested-retention-zero': {
    description: 'maxHistorySize 0; no completed entity history retained',
    build: async (count) => {
      const tree = await createTree(count, 0);
      await designatedWrites(tree, count, DESIGNATED_WRITES);
      await settle('requested-retention-zero-workload');
      return tree;
    },
  },
  'requested-retention-zero-scalar': {
    description: 'maxHistorySize 0; no completed scalar history retained',
    build: async (count) => {
      const tree = await createTree(count, 0);
      await designatedScalarWrites(tree, DESIGNATED_WRITES);
      await settle('requested-retention-zero-scalar-workload');
      return tree;
    },
  },
  'buffer-two': {
    description: 'capacity 2; at most two retained undo turns',
    build: async (count) => {
      const tree = await createTree(count, 2);
      await designatedWrites(tree, count, DESIGNATED_WRITES);
      await settle('buffer-two-workload');
      return tree;
    },
  },
  'buffer-two-scalar': {
    description: 'buffer length 2; scalar turns over shared entity subtree',
    build: async (count) => {
      const tree = await createTree(count, 2);
      await designatedScalarWrites(tree, DESIGNATED_WRITES);
      await settle('buffer-two-scalar-workload');
      return tree;
    },
  },
  'buffer-twenty': {
    description: 'capacity 20; at most 20 retained undo turns',
    build: async (count) => {
      const tree = await createTree(count, 20);
      await designatedWrites(tree, count, DESIGNATED_WRITES);
      await settle('buffer-twenty-workload');
      return tree;
    },
  },
  'buffer-twenty-scalar': {
    description: 'buffer length 20; scalar turns over shared entity subtree',
    build: async (count) => {
      const tree = await createTree(count, 20);
      await designatedScalarWrites(tree, DESIGNATED_WRITES);
      await settle('buffer-twenty-scalar-workload');
      return tree;
    },
  },
  'buffer-large': {
    description: `buffer capacity ${DESIGNATED_WRITES + 1}; all designated turns retained`,
    build: async (count) => {
      const tree = await createTree(count, DESIGNATED_WRITES + 1);
      await designatedWrites(tree, count, DESIGNATED_WRITES);
      await settle('buffer-large-workload');
      return tree;
    },
  },
  'buffer-large-scalar': {
    description: 'large buffer; scalar turns over shared entity subtree',
    build: async (count) => {
      const tree = await createTree(count, DESIGNATED_WRITES + 1);
      await designatedScalarWrites(tree, DESIGNATED_WRITES);
      await settle('buffer-large-scalar-workload');
      return tree;
    },
  },
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${name}`);
  let capability;
  const result = await measureCapabilityRetained(async () => {
    const tree = await arm.build(size);
    capability = inspectCapability(tree);
    return tree;
  }, name);
  console.log(JSON.stringify({
    arm: name,
    n: size,
    description: arm.description,
    retainedBytes: result.retainedBytes,
    collectable: result.collectable,
    claimRegistryCollectable: result.claimRegistryCollectable,
    descriptorStoreCollectable: result.descriptorStoreCollectable,
    quiesceRounds: result.quiesceRounds,
  ...capability,
  }));
  process.exit(0);
}

const measureOnce = (name, n) => {
  const result = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--arm',
      name,
      '--n',
      String(n),
      '--designated-writes',
      String(DESIGNATED_WRITES),
      '--undesignated-writes',
      String(UNDESIGNATED_WRITES),
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 240_000,
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || `${name}@${n} exited ${String(result.status)}`);
  }
  const point = JSON.parse(result.stdout.trim().split('\n').at(-1));
  if (
    name.startsWith('requested-retention-zero') &&
    result.stderr.includes('[ST2032]')
  ) {
    throw new Error(
      `requested maxHistorySize 0 emitted obsolete ST2032 diagnostic: ${JSON.stringify(result.stderr)}`
    );
  }
  return point;
};

const measurePoint = (name, n) => {
  const samples = Array.from({ length: SAMPLES }, () => measureOnce(name, n));
  return samples.sort((left, right) => left.retainedBytes - right.retainedBytes)[
    Math.floor(samples.length / 2)
  ];
};

const linearFit = (points) => {
  const used = points.filter((point) => point.n > 0);
  const meanN = used.reduce((sum, point) => sum + point.n, 0) / used.length;
  const meanBytes = used.reduce((sum, point) => sum + point.retainedBytes, 0) / used.length;
  const numerator = used.reduce(
    (sum, point) => sum + (point.n - meanN) * (point.retainedBytes - meanBytes),
    0
  );
  const denominator = used.reduce(
    (sum, point) => sum + (point.n - meanN) ** 2,
    0
  );
  const bytesPerSubject = numerator / denominator;
  const fittedFixedBytes = meanBytes - bytesPerSubject * meanN;
  const totalVariation = used.reduce(
    (sum, point) => sum + (point.retainedBytes - meanBytes) ** 2,
    0
  );
  const residualVariation = used.reduce((sum, point) => {
    const fitted = fittedFixedBytes + bytesPerSubject * point.n;
    return sum + (point.retainedBytes - fitted) ** 2;
  }, 0);
  return {
    bytesPerSubject,
    fittedFixedBytes,
    rSquared: totalVariation === 0 ? 1 : 1 - residualVariation / totalVariation,
  };
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((n) => measurePoint(name, n));
  return { arm: name, description: arm.description, points, ...linearFit(points) };
});
const byName = new Map(rows.map((row) => [row.arm, row]));
const rawSlope = byName.get('raw').bytesPerSubject;
const derived = {
  causalRuntimeSubjectSlope:
    byName.get('causal-runtime-only').bytesPerSubject - rawSlope,
  restorationConfiguredSubjectSlope:
    byName.get('configured-unused').bytesPerSubject -
    byName.get('causal-runtime-only').bytesPerSubject,
  configuredUnusedSubjectSlope:
    byName.get('configured-unused').bytesPerSubject - rawSlope,
  undesignatedWriteSubjectSlope:
    byName.get('configured-undesignated').bytesPerSubject -
    byName.get('configured-unused').bytesPerSubject,
};
for (const name of [
  'requested-retention-zero',
  'buffer-two',
  'buffer-twenty',
  'buffer-large',
]) {
  const row = byName.get(name);
  const point = row.points.at(-1);
  const unusedPoint = byName.get('configured-unused').points.at(-1);
  const addedEntries = point.historyEntries - unusedPoint.historyEntries;
  derived[`${name}IncrementalBytesPerAddedEntryAt100k`] =
    addedEntries === 0
      ? 0
      : (point.retainedBytes - unusedPoint.retainedBytes) / addedEntries;
  derived[`${name}CompositeBytesPerClaimedSubjectAt100k`] =
    point.claimedSubjects === 0
      ? 0
      : (point.retainedBytes - byName.get('configured-unused').points.at(-1).retainedBytes) /
        point.claimedSubjects;
  const scalarName = name.replace(/$/, '-scalar');
  if (byName.has(scalarName)) {
    const scalarPoint = byName.get(scalarName).points.at(-1);
    derived[`${name}EntityTurnIncrementAt100k`] =
      point.retainedBytes - scalarPoint.retainedBytes;
  }
}

const problems = [];
for (const row of rows) {
  if (row.rSquared < 0.99) {
    problems.push(`${row.arm} fit R² ${row.rSquared.toFixed(4)} is below 0.99`);
  }
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.arm}@${point.n} did not collect`);
    if (!point.claimRegistryCollectable) {
      problems.push(`${row.arm}@${point.n} claim registry did not collect`);
    }
    if (!point.descriptorStoreCollectable) {
      problems.push(`${row.arm}@${point.n} descriptor store did not collect`);
    }
  }
}
if (Math.abs(derived.causalRuntimeSubjectSlope) > 32) {
  problems.push(`causal-runtime-only slope drifted to ${derived.causalRuntimeSubjectSlope.toFixed(1)} B/subject`);
}
if (Math.abs(derived.restorationConfiguredSubjectSlope) > 32) {
  problems.push(`configured-unused restoration slope is ${derived.restorationConfiguredSubjectSlope.toFixed(1)} B/subject`);
}
if (Math.abs(derived.undesignatedWriteSubjectSlope) > 32) {
  problems.push(`undesignated writes accumulated ${derived.undesignatedWriteSubjectSlope.toFixed(1)} B/subject`);
}
for (const row of [byName.get('configured-unused'), byName.get('configured-undesignated')]) {
  for (const point of row.points) {
    if (
      point.historyEntries !== 0 ||
      point.claimedSubjects !== 0 ||
      point.subjectDescriptors !== 0 ||
      point.structuralEffects !== 0
    ) {
      problems.push(`${row.arm}@${point.n} retained unexpected history or claims`);
    }
  }
}
const requestedZero = byName.get('requested-retention-zero').points.at(-1);
const expectedRequestedZeroEntries = 0;
if (requestedZero.historyEntries !== expectedRequestedZeroEntries) {
  problems.push(
    `requested maxHistorySize 0 retained ${requestedZero.historyEntries}, expected zero`
  );
}
for (const [name, expectedEntries] of [
  ['requested-retention-zero-scalar', expectedRequestedZeroEntries],
  ['buffer-two', Math.min(DESIGNATED_WRITES, 2)],
  ['buffer-two-scalar', Math.min(DESIGNATED_WRITES, 2)],
  ['buffer-twenty', Math.min(DESIGNATED_WRITES, 20)],
  ['buffer-twenty-scalar', Math.min(DESIGNATED_WRITES, 20)],
  ['buffer-large', DESIGNATED_WRITES],
  ['buffer-large-scalar', DESIGNATED_WRITES],
]) {
  const point = byName.get(name).points.at(-1);
  if (point.historyEntries !== expectedEntries) {
    problems.push(`${name} retained ${point.historyEntries} entries, expected ${expectedEntries}`);
  }
  const expectedClaims = name.endsWith('-scalar') ? 0 : Math.min(DESIGNATED_WRITES, expectedEntries);
  if (point.claimedSubjects !== expectedClaims) {
    problems.push(`${name} retained ${point.claimedSubjects} claims, expected ${expectedClaims}`);
  }
}
if (problems.length > 0) {
  throw new Error(`E5 capability attribution failed:\n${problems.join('\n')}`);
}

const output = {
  sizes: SIZES,
  samples: SAMPLES,
  designatedWrites: DESIGNATED_WRITES,
  undesignatedWrites: UNDESIGNATED_WRITES,
  rows,
  derived,
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log('\nENTITY-PHYSICAL-DENSITY-0 / E5');
console.log(`${SAMPLES} isolated samples; ${DESIGNATED_WRITES} designated and ${UNDESIGNATED_WRITES} undesignated writes\n`);
console.log(
  'arm'.padEnd(29) +
    'B/subject'.padStart(11) +
    'fixed'.padStart(12) +
    '100k heap'.padStart(13) +
    'entries'.padStart(10) +
    'claims'.padStart(9) +
    'subject desc'.padStart(13)
);
console.log('-'.repeat(84));
for (const row of rows) {
  const last = row.points.at(-1);
  console.log(
    row.arm.padEnd(29) +
      row.bytesPerSubject.toFixed(1).padStart(11) +
      kb(row.fittedFixedBytes).padStart(12) +
      mb(last.retainedBytes).padStart(13) +
      String(last.historyEntries).padStart(10) +
      String(last.claimedSubjects).padStart(9) +
      String(last.subjectDescriptors).padStart(13)
  );
  console.log(`  ${row.description}`);
}
console.log('\nCapability-specific subject slopes');
console.log(`  causal runtime only      ${derived.causalRuntimeSubjectSlope.toFixed(1)} B/live subject`);
console.log(`  restoration over causal  ${derived.restorationConfiguredSubjectSlope.toFixed(1)} B/live subject`);
console.log(`  configured total         ${derived.configuredUnusedSubjectSlope.toFixed(1)} B/live subject`);
console.log(`  ${String(UNDESIGNATED_WRITES).padEnd(4)} undesignated writes ${derived.undesignatedWriteSubjectSlope.toFixed(1)} B/live subject`);
console.log('\nHistory density at 100k live subjects');
for (const name of ['requested-retention-zero', 'buffer-two', 'buffer-twenty', 'buffer-large']) {
  console.log(
    `  ${name.padEnd(25)} ` +
      `${derived[`${name}IncrementalBytesPerAddedEntryAt100k`].toFixed(1).padStart(10)} incremental B/added entry  ` +
      `${derived[`${name}CompositeBytesPerClaimedSubjectAt100k`].toFixed(1).padStart(10)} B/composite claimed subject` +
      (derived[`${name}EntityTurnIncrementAt100k`] === undefined
        ? ''
        : `  ${derived[`${name}EntityTurnIncrementAt100k`].toFixed(1)} B entity-vs-scalar total`)
  );
}
console.log(
  '\nHistory entry counts are reported exactly; positive maxHistorySize is a retained-entry capacity.\n' +
    'Requested zero retains no completed history, claims, or descriptors after settlement.'
);
