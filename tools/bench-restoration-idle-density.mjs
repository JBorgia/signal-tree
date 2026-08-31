#!/usr/bin/env node
/**
 * RESTORATION-IDLE-DENSITY-0 / R0: eager restoration byte attribution.
 *
 * No production representation changes. Production causal-only and configured-
 * unused trees are compared with synthetic copies of the exact descriptor graph
 * created by the initial EntityMap population.
 *
 * Usage:
 *   node --expose-gc tools/bench-restoration-idle-density.mjs
 *   node --expose-gc tools/bench-restoration-idle-density.mjs --samples 1
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-restoration-idle-density.mjs');

const DIST = join(process.cwd(), 'dist/packages/kernel/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const [
  { entityMap, restoration, signalTree },
  { getTreeRealizationDescriptors },
] = await Promise.all([
  import(`${DIST}/index.js`),
  import(`${DIST}/lib/internals/causal-runtime/tree-realization-adapter.js`),
]);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const SIZES = [0, 1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
for (const [name, value] of [['samples', SAMPLES], ['n', size]]) {
  if (!Number.isSafeInteger(value) || value < (name === 'samples' ? 1 : 0)) {
    throw new RangeError(`${name} has an invalid value`);
  }
}

const seed = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    name: `n${index}`,
    value: index,
  }));

const createProductionTree = async (count, withRestoration) => {
  const initial = { rows: entityMap({ selectId: (row) => row.id }) };
  const tree = withRestoration
    ? signalTree(initial, {
        enhancers: [restoration({ maxHistorySize: 20 })],
        capabilities: ['causal-runtime'],
      })
    : signalTree(initial, { capabilities: ['causal-runtime'] });
  tree.$.rows.setAll(seed(count));
  await quiesce({ label: 'idle-production-population' });
  return tree;
};

const extractProductionIdleArtifacts = async (count) => {
  const tree = await createProductionTree(count, true);
  const descriptors = getTreeRealizationDescriptors(tree);
  const initialState = tree.getRestorationHistory()[0]?.state;
  tree.destroy();
  return { descriptors, initialState };
};

const sharedValue = { id: 0, name: 'shared', value: 0 };
const effectFor = (index, uniquePayload = true, count = 0) => ({
  kind: 'add',
  subject: index + 1,
  key: index,
  value: uniquePayload
    ? { id: index, name: `n${index}`, value: index }
    : sharedValue,
  beforeSubject: index === 0 ? undefined : index,
  afterSubject: index + 1 >= count ? undefined : index + 2,
});

const subjectDescriptorMap = (count) => {
  const subjectDescriptors = new Map();
  for (let index = 0; index < count; index++) {
    subjectDescriptors.set(String(index + 1), {
      path: 'rows',
      ownerPath: 'rows',
      collectionPath: 'rows',
      fieldPathFromRow: undefined,
    });
  }
  return subjectDescriptors;
};

const subjectDescriptorIndex = (count) => {
  const descriptor = {
    path: 'rows',
    ownerPath: 'rows',
    collectionPath: 'rows',
    fieldPathFromRow: undefined,
  };
  return new Map(
    Array.from({ length: count }, (_, index) => [String(index + 1), descriptor])
  );
};

const subjectDescriptorObjects = (count) =>
  Array.from({ length: count }, () => ({
    path: 'rows',
    ownerPath: 'rows',
    collectionPath: 'rows',
    fieldPathFromRow: undefined,
  }));

const effectObjects = (count) =>
  Array.from({ length: count }, (_, index) => effectFor(index, true, count));

const structuralEffectIndex = (count) => {
  const sharedEffect = effectFor(0, false, 1);
  const structuralEffects = new Map();
  for (let index = 0; index < count; index++) {
    structuralEffects.set(`add:${index + 1}:${index}`, sharedEffect);
  }
  return structuralEffects;
};

const subjectEffectIndex = (count) => {
  const sharedEffect = effectFor(0, false, 1);
  const structuralEffectBySubject = new Map();
  for (let index = 0; index < count; index++) {
    structuralEffectBySubject.set(String(index + 1), sharedEffect);
  }
  return structuralEffectBySubject;
};

const effectIndexGraph = (count) => {
  const structuralEffects = new Map();
  const structuralEffectBySubject = new Map();
  for (let index = 0; index < count; index++) {
    const effect = effectFor(index, true, count);
    structuralEffects.set(`add:${index + 1}:${index}`, effect);
    structuralEffectBySubject.set(String(index + 1), effect);
  }
  return { structuralEffects, structuralEffectBySubject };
};

const exactDescriptorGraph = (count) => {
  const subjectDescriptors = subjectDescriptorMap(count);
  const structuralEffects = new Map();
  const structuralEffectBySubject = new Map();
  for (let index = 0; index < count; index++) {
    const effect = effectFor(index, true, count);
    structuralEffects.set(`add:${index + 1}:${index}`, effect);
    structuralEffectBySubject.set(String(index + 1), effect);
  }
  return new Map([[2, {
    path: 'rows.0',
    ownerPath: 'rows',
    collectionPath: 'rows',
    fieldPathFromRow: undefined,
    structuralEffects,
    structuralEffectBySubject,
    subjectDescriptors,
  }]]);
};

const exactIdleGraph = (count) => ({
  canonicalBacking: seed(count),
  descriptors: exactDescriptorGraph(count),
  initialHistoryState: {
    rows: seed(count).map((entity) => ({ ...entity })),
  },
});

const syntheticCanonicalBaseline = (count) => ({
  canonicalBacking: seed(count),
});

const ARMS = {
  'production-causal': {
    owner: 'causal-runtime production control',
    build: (count) => createProductionTree(count, false),
  },
  'production-restoration-unused': {
    owner: 'restoration configured, INIT only, no claims',
    build: (count) => createProductionTree(count, true),
  },
  'production-idle-artifacts': {
    owner: 'actual production descriptor Map plus INIT state after tree destroy',
    build: extractProductionIdleArtifacts,
  },
  'initial-snapshot-pointers': {
    owner: 'INIT collection pointer array only',
    build: (count) => Array.from({ length: count }, () => sharedValue),
  },
  'initial-snapshot-materialized': {
    owner: 'INIT pointer array plus distinct materialized entity objects',
    build: (count) => seed(count).map((entity) => ({ ...entity })),
  },
  'subject-descriptor-map': {
    owner: 'subjectDescriptors string key + address object',
    build: subjectDescriptorMap,
  },
  'subject-descriptor-index': {
    owner: 'subjectDescriptors Map/string keys with one shared address object',
    build: subjectDescriptorIndex,
  },
  'subject-descriptor-objects': {
    owner: 'one four-field address object per subject',
    build: subjectDescriptorObjects,
  },
  'effect-objects': {
    owner: 'one structural add effect object per subject',
    build: effectObjects,
  },
  'structural-effect-index': {
    owner: 'structuralEffects operation-key Map entries',
    build: structuralEffectIndex,
  },
  'subject-effect-index': {
    owner: 'structuralEffectBySubject string-key Map entries',
    build: subjectEffectIndex,
  },
  'effect-index-graph': {
    owner: 'both effect indexes sharing one effect object per subject',
    build: effectIndexGraph,
  },
  'exact-descriptor-graph': {
    owner: 'all three descriptor indexes with shared effect identity',
    build: exactDescriptorGraph,
  },
  'exact-idle-graph': {
    owner: 'exact descriptor graph plus INIT materialized entity snapshot',
    build: exactIdleGraph,
  },
  'synthetic-canonical-baseline': {
    owner: 'canonical entity backing matched by exact idle graph',
    build: syntheticCanonicalBaseline,
  },
};

const measureArmRetained = async (build, label) => {
  const start = await quiesce({ label: `${label} (baseline)` });
  let held = await build();
  const settled = await quiesce({ label: `${label} (held)` });
  const ref = new WeakRef(held);
  if (typeof held.destroy === 'function') held.destroy();
  held = null;
  await quiesce({ label: `${label} (released)` });
  return {
    retainedBytes: settled.heapUsed - start.heapUsed,
    collectable: ref.deref() === undefined,
  };
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${name}`);
  const result = await measureArmRetained(() => arm.build(size), name);
  console.log(JSON.stringify({
    arm: name,
    n: size,
    owner: arm.owner,
    retainedBytes: result.retainedBytes,
    collectable: result.collectable,
  }));
  process.exit(0);
}

const measureOnce = (name, n) => {
  const output = execFileSync(
    process.execPath,
    ['--expose-gc', new URL(import.meta.url).pathname, '--arm', name, '--n', String(n)],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const measurePoint = (name, n) => {
  const samples = Array.from({ length: SAMPLES }, () => measureOnce(name, n));
  const failed = samples.filter((sample) => !sample.collectable);
  const median = samples.sort((left, right) => left.retainedBytes - right.retainedBytes)[
    Math.floor(samples.length / 2)
  ];
  return { ...median, allSamplesCollectable: failed.length === 0 };
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
  return {
    bytesPerSubject,
    fittedFixedBytes: meanBytes - bytesPerSubject * meanN,
  };
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((n) => measurePoint(name, n));
  return { arm: name, owner: arm.owner, points, ...linearFit(points) };
});
const byName = new Map(rows.map((row) => [row.arm, row]));
const productionDelta =
  byName.get('production-restoration-unused').bytesPerSubject -
  byName.get('production-causal').bytesPerSubject;
const productionArtifacts =
  byName.get('production-idle-artifacts').bytesPerSubject;
const exactGraph =
  byName.get('exact-idle-graph').bytesPerSubject -
  byName.get('synthetic-canonical-baseline').bytesPerSubject;
const closure = exactGraph / productionDelta;
const productionArtifactClosure = productionArtifacts / productionDelta;
const repairedIdleState =
  Math.abs(productionDelta) <= 32 && Math.abs(productionArtifacts) <= 32;
const primary = {
  initialSnapshotMaterialized:
    byName.get('initial-snapshot-materialized').bytesPerSubject,
  subjectDescriptorMap: byName.get('subject-descriptor-map').bytesPerSubject,
  effectIndexGraph: byName.get('effect-index-graph').bytesPerSubject,
};
const diagnostics = {
  initialSnapshotPointers: byName.get('initial-snapshot-pointers').bytesPerSubject,
  subjectDescriptorIndex:
    byName.get('subject-descriptor-index').bytesPerSubject,
  subjectDescriptorObjects:
    byName.get('subject-descriptor-objects').bytesPerSubject,
  effectObjects: byName.get('effect-objects').bytesPerSubject,
  structuralEffectIndex: byName.get('structural-effect-index').bytesPerSubject,
  subjectEffectIndex: byName.get('subject-effect-index').bytesPerSubject,
};
const primarySum = Object.values(primary).reduce((sum, value) => sum + value, 0);
const problems = [];
for (const row of rows) {
  for (const point of row.points) {
    if (!point.allSamplesCollectable) {
      problems.push(`${row.arm}@${point.n} had a sample that did not collect`);
    }
  }
}
if (
  !repairedIdleState &&
  (productionArtifactClosure < 0.9 || productionArtifactClosure > 1.1)
) {
  problems.push(
    `extracted production artifacts ${productionArtifacts.toFixed(1)} vs production ${productionDelta.toFixed(1)} B/subject close at ${(productionArtifactClosure * 100).toFixed(1)}%`
  );
}
if (problems.length > 0) {
  throw new Error(`RESTORATION-IDLE-DENSITY-0 attribution failed:\n${problems.join('\n')}`);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows, repairedIdleState, productionDelta, productionArtifacts, productionArtifactClosure, exactGraph, closure, primary, primarySum, diagnostics }, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nRESTORATION-IDLE-DENSITY-0 / R0');
console.log(`${SAMPLES} isolated samples per arm and size\n`);
console.log('arm'.padEnd(34) + SIZES.map((n) => String(n).padStart(11)).join('') + '   B/subject');
console.log('-'.repeat(90));
for (const row of rows) {
  console.log(
    row.arm.padEnd(34) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      row.bytesPerSubject.toFixed(1).padStart(12)
  );
  console.log(`  ${row.owner}`);
}
console.log('\nStandalone owner-family diagnostics (not additive)');
for (const [name, bytes] of Object.entries(primary)) {
  console.log(`  ${name.padEnd(27)} ${bytes.toFixed(1).padStart(8)} B/subject`);
}
console.log(`  ${'standalone sum (not additive)'.padEnd(27)} ${primarySum.toFixed(1).padStart(8)} B/subject`);
console.log('\nOverlapping shape diagnostics');
for (const [name, bytes] of Object.entries(diagnostics)) {
  console.log(`  ${name.padEnd(27)} ${bytes.toFixed(1).padStart(8)} B/subject`);
}
console.log('\nAttribution closure');
console.log(`  live disposition                           ${repairedIdleState ? 'REPAIRED / ZERO IDLE SUBJECT SLOPE' : 'EAGER ARTIFACTS PRESENT'}`);
console.log(`  production restoration-over-causal delta  ${productionDelta.toFixed(1)} B/subject`);
console.log(`  extracted actual production artifacts     ${productionArtifacts.toFixed(1)} B/subject`);
console.log(`  extracted artifacts / production          ${repairedIdleState ? 'n/a (idle slope is zero)' : `${(productionArtifactClosure * 100).toFixed(1)}%`}`);
console.log(`  shape-matched synthetic idle graph        ${exactGraph.toFixed(1)} B/subject`);
console.log(`  synthetic / production (diagnostic only)  ${repairedIdleState ? 'n/a (historical shape)' : `${(closure * 100).toFixed(1)}%`}`);
console.log(
  '\nExtracted production artifacts are the historical eager-state closure authority. Standalone diagnostics overlap through allocation context, keys, and objects.\n' +
    'No production representation or restoration semantics changed.'
);
