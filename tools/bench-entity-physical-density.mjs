#!/usr/bin/env node
/**
 * ENTITY-PHYSICAL-DENSITY-0 / E0: retained-byte attribution.
 *
 * No production representation is changed. Each arm runs in a fresh process,
 * imports the same production modules, and uses the shared heap-quiescence
 * protocol. Standalone arms reproduce the exact field shapes currently owned by
 * StructuralStore and EntityValueStore; actual-class arms validate that their
 * sum explains the production physical-store floor.
 *
 * Usage:
 *   node --expose-gc tools/bench-entity-physical-density.mjs
 *   node --expose-gc tools/bench-entity-physical-density.mjs --json
 *   node --expose-gc tools/bench-entity-physical-density.mjs --arm actual-physical --n 10000
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-entity-physical-density.mjs');

const DIST = join(process.cwd(), 'dist/packages/kernel/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const [{ StructuralStore }, { EntityValueStore }] = await Promise.all([
  import(`${DIST}/lib/physical/structural-store.js`),
  import(`${DIST}/lib/physical/entity-value-store.js`),
]);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const size = Number(argument('--n', 10_000));
const SAMPLES = Number(argument('--samples', 3));

const entity = (index) => ({ id: index, name: `n${index}`, value: index });
const entities = (count) =>
  Array.from({ length: count }, (_, index) => entity(index));

const linkedNodes = (count) => {
  let head;
  let tail;
  const nodes = [];
  for (let index = 0; index < count; index++) {
    const node = {
      key: index,
      subjectId: index + 1,
      prev: tail,
      next: undefined,
    };
    if (tail) tail.next = node;
    else head = node;
    tail = node;
    nodes.push(node);
  }
  return { head, tail, nodes };
};

const syntheticStructural = (count) => {
  const subjectIds = new Map();
  const subjectStates = new Map();
  const subjectRevisions = new Map();
  const activeNodesByKey = new Map();
  const activeNodesBySubject = new Map();
  const order = linkedNodes(count);

  for (let index = 0; index < count; index++) {
    const subjectId = index + 1;
    const node = order.nodes[index];
    subjectIds.set(index, subjectId);
    subjectStates.set(subjectId, {
      active: true,
      key: index,
      restoreAllowed: true,
    });
    subjectRevisions.set(subjectId, 0);
    activeNodesByKey.set(index, node);
    activeNodesBySubject.set(subjectId, node);
  }

  return {
    subjectIds,
    subjectStates,
    subjectRevisions,
    activeNodesByKey,
    activeNodesBySubject,
    activeHead: order.head,
    activeTail: order.tail,
    activeCount: count,
    nextSubjectId: count + 1,
    collectionIncarnation: 0,
  };
};

const ARMS = {
  'payload-array': {
    owner: 'payload control',
    authority: 'application entity values',
    scalesWith: 'existing entities',
    build: entities,
  },
  'payload-map': {
    owner: 'payload control',
    authority: 'conventional key -> entity representation',
    scalesWith: 'existing entities',
    build: (count) => new Map(entities(count).map((row) => [row.id, row])),
  },
  'key-subject-index': {
    owner: 'StructuralStore.subjectIds',
    authority: 'key -> stable SubjectId address',
    scalesWith: 'live subjects',
    build: (count) =>
      new Map(Array.from({ length: count }, (_, index) => [index, index + 1])),
  },
  'subject-lifetime-index': {
    owner: 'StructuralStore.subjectStates',
    authority: 'subject lifetime, active key, restore permission',
    scalesWith: 'existing subjects',
    build: (count) =>
      new Map(
        Array.from({ length: count }, (_, index) => [
          index + 1,
          { active: true, key: index, restoreAllowed: true },
        ])
      ),
  },
  'subject-revision-index': {
    owner: 'StructuralStore.subjectRevisions',
    authority: 'subject revision',
    scalesWith: 'existing subjects',
    build: (count) =>
      new Map(Array.from({ length: count }, (_, index) => [index + 1, 0])),
  },
  'ordering-nodes': {
    owner: 'StructuralStore active linked list',
    authority: 'active ordering and neighbor identity',
    scalesWith: 'live subjects',
    build: (count) => {
      const order = linkedNodes(count);
      return { head: order.head, tail: order.tail };
    },
  },
  'ordering-plus-key-index': {
    owner: 'activeNodesByKey over shared ordering nodes',
    authority: 'O(1) live node lookup by key',
    scalesWith: 'live subjects',
    build: (count) => {
      const order = linkedNodes(count);
      return {
        head: order.head,
        tail: order.tail,
        index: new Map(order.nodes.map((node) => [node.key, node])),
      };
    },
  },
  'ordering-plus-subject-index': {
    owner: 'activeNodesBySubject over shared ordering nodes',
    authority: 'O(1) live node lookup by SubjectId',
    scalesWith: 'live subjects',
    build: (count) => {
      const order = linkedNodes(count);
      return {
        head: order.head,
        tail: order.tail,
        index: new Map(order.nodes.map((node) => [node.subjectId, node])),
      };
    },
  },
  'ordering-plus-both-indexes': {
    owner: 'both active-node indexes over one node graph',
    authority: 'dual live key/SubjectId lookup',
    scalesWith: 'live subjects',
    build: (count) => {
      const order = linkedNodes(count);
      return {
        head: order.head,
        tail: order.tail,
        byKey: new Map(order.nodes.map((node) => [node.key, node])),
        bySubject: new Map(
          order.nodes.map((node) => [node.subjectId, node])
        ),
      };
    },
  },
  'subject-value-index': {
    owner: 'EntityValueStore.retainedEntities index only',
    authority: 'SubjectId -> entity value address',
    scalesWith: 'retained subject values',
    build: (count) => {
      const shared = {};
      return new Map(
        Array.from({ length: count }, (_, index) => [index + 1, shared])
      );
    },
  },
  'actual-value-store': {
    owner: 'EntityValueStore',
    authority: 'entity value',
    scalesWith: 'retained subject values',
    build: (count) => {
      const store = new EntityValueStore();
      for (const row of entities(count)) {
        store.retainSubjectValue(row.id + 1, row);
      }
      return store;
    },
  },
  'synthetic-structural': {
    owner: 'all StructuralStore fields, exact shapes',
    authority: 'structural authorities physically separated',
    scalesWith: 'live/existing subjects',
    build: syntheticStructural,
  },
  'actual-structural': {
    owner: 'StructuralStore',
    authority: 'key, SubjectId, lifetime, revision, membership, order',
    scalesWith: 'live/existing subjects',
    build: (count) => {
      const store = new StructuralStore();
      for (let index = 0; index < count; index++) {
        const subjectId = store.allocateFreshSubjectId();
        store.createSubject(subjectId, index);
      }
      return store;
    },
  },
  'synthetic-physical': {
    owner: 'exact synthetic StructuralStore fields + value Map',
    authority: 'same semantic owners, physically separate fields',
    scalesWith: 'live/existing subjects',
    build: (count) => {
      const structural = syntheticStructural(count);
      const values = new Map();
      for (const row of entities(count)) values.set(row.id + 1, row);
      return { structural, values };
    },
  },
  'actual-physical': {
    owner: 'StructuralStore + EntityValueStore',
    authority: 'production physical-store floor',
    scalesWith: 'live/existing subjects',
    build: (count) => {
      const structural = new StructuralStore();
      const values = new EntityValueStore();
      for (const row of entities(count)) {
        const subjectId = structural.allocateFreshSubjectId();
        structural.createSubject(subjectId, row.id);
        values.retainSubjectValue(subjectId, row);
      }
      return { structural, values };
    },
  },
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (!arm) throw new Error(`unknown arm: ${name}`);
  const result = await measureRetained(() => arm.build(size), { label: name });
  console.log(JSON.stringify({
    arm: name,
    n: size,
    owner: arm.owner,
    authority: arm.authority,
    scalesWith: arm.scalesWith,
    retainedBytes: result.retainedBytes,
    quiesceRounds: result.quiesceRounds,
    collectable: result.collectable,
  }));
  process.exit(0);
}

const measureArmOnce = (name, n) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--arm',
      name,
      '--n',
      String(n),
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

const measureArm = (name, n) => {
  const samples = Array.from({ length: SAMPLES }, () => measureArmOnce(name, n));
  samples.sort((left, right) => left.retainedBytes - right.retainedBytes);
  return samples[Math.floor(samples.length / 2)];
};

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
  const bytesPerEntity = numerator / denominator;
  return {
    bytesPerEntity,
    fittedFixedBytes: meanBytes - bytesPerEntity * meanN,
  };
};

const rows = Object.keys(ARMS).map((name) => {
  const points = SIZES.map((n) => measureArm(name, n));
  return { ...points[0], points, ...linearFit(points) };
});

const byName = new Map(rows.map((row) => [row.arm, row]));
const nodeSlope = byName.get('ordering-nodes').bytesPerEntity;
const derived = {
  activeByKeyIncrement:
    byName.get('ordering-plus-key-index').bytesPerEntity - nodeSlope,
  activeBySubjectIncrement:
    byName.get('ordering-plus-subject-index').bytesPerEntity - nodeSlope,
  bothActiveIndexesIncrement:
    byName.get('ordering-plus-both-indexes').bytesPerEntity - nodeSlope,
  syntheticVsActualStructural:
    byName.get('synthetic-structural').bytesPerEntity /
    byName.get('actual-structural').bytesPerEntity,
  syntheticVsActualPhysical:
    byName.get('synthetic-physical').bytesPerEntity /
    byName.get('actual-physical').bytesPerEntity,
};

const exclusive = {
  entityPayload:
    byName.get('actual-value-store').bytesPerEntity -
    byName.get('subject-value-index').bytesPerEntity,
  subjectValueIndex: byName.get('subject-value-index').bytesPerEntity,
  keySubjectIndex: byName.get('key-subject-index').bytesPerEntity,
  subjectLifetimeIndex: byName.get('subject-lifetime-index').bytesPerEntity,
  subjectRevisionIndex: byName.get('subject-revision-index').bytesPerEntity,
  orderingNodes: nodeSlope,
  activeByKeyIndex: derived.activeByKeyIncrement,
  activeBySubjectIndex: derived.activeBySubjectIncrement,
};
const attributedStructural =
  exclusive.keySubjectIndex +
  exclusive.subjectLifetimeIndex +
  exclusive.subjectRevisionIndex +
  exclusive.orderingNodes +
  exclusive.activeByKeyIndex +
  exclusive.activeBySubjectIndex;
const attributedPhysical =
  attributedStructural + exclusive.entityPayload + exclusive.subjectValueIndex;
derived.componentVsActualStructural =
  attributedStructural / byName.get('actual-structural').bytesPerEntity;
derived.componentVsActualPhysical =
  attributedPhysical / byName.get('actual-physical').bytesPerEntity;

const problems = [];
for (const row of rows) {
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.arm}@${point.n} did not collect`);
  }
}
for (const [name, ratio] of Object.entries({
  syntheticStructural: derived.syntheticVsActualStructural,
  syntheticPhysical: derived.syntheticVsActualPhysical,
  componentStructural: derived.componentVsActualStructural,
  componentPhysical: derived.componentVsActualPhysical,
})) {
  if (ratio < 0.9 || ratio > 1.1) {
    problems.push(`${name} attribution closes at ${(ratio * 100).toFixed(1)}%`);
  }
}
if (problems.length > 0) {
  throw new Error(`E0 attribution failed:\n${problems.join('\n')}`);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows, exclusive, derived }, null, 2));
  process.exit(0);
}

const physicalFloor = byName.get('actual-physical').bytesPerEntity;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const fixed = (bytes) => `${Math.round(bytes / 1024)} KB`;

console.log('\nENTITY-PHYSICAL-DENSITY-0 / E0');
console.log(`retained heap after quiescence; ${SAMPLES} isolated samples per arm and size\n`);
console.log(
  'arm'.padEnd(34) +
    SIZES.map((n) => String(n).padStart(11)).join('') +
    '   B/entity   % floor'
);
console.log('-'.repeat(101));
for (const row of rows) {
  console.log(
    row.arm.padEnd(34) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      String(Math.round(row.bytesPerEntity)).padStart(11) +
      `${((row.bytesPerEntity / physicalFloor) * 100).toFixed(1)}%`.padStart(10)
  );
  console.log(
    `  owner: ${row.owner}; empty/tree ${fixed(row.points[0].retainedBytes)}; fitted intercept ${fixed(row.fittedFixedBytes)}; scales: ${row.scalesWith}`
  );
  console.log(`  authority: ${row.authority}`);
}

console.log('\nShared-node index increments');
console.log(`  activeNodesByKey       ${Math.round(derived.activeByKeyIncrement)} B/live subject`);
console.log(`  activeNodesBySubject   ${Math.round(derived.activeBySubjectIncrement)} B/live subject`);
console.log(`  both active indexes    ${Math.round(derived.bothActiveIndexesIncrement)} B/live subject`);
console.log('\nExclusive physical-floor attribution');
for (const [name, bytes] of Object.entries(exclusive)) {
  console.log(
    `  ${name.padEnd(27)} ${String(Math.round(bytes)).padStart(4)} B/entity  ` +
      `${((bytes / physicalFloor) * 100).toFixed(1).padStart(5)}%`
  );
}
console.log('\nAttribution closure');
console.log(
  `  synthetic/actual StructuralStore slope: ${(derived.syntheticVsActualStructural * 100).toFixed(1)}%`
);
console.log(
  `  synthetic/actual physical slope:        ${(derived.syntheticVsActualPhysical * 100).toFixed(1)}%`
);
console.log(
  `  exclusive/actual StructuralStore slope: ${(derived.componentVsActualStructural * 100).toFixed(1)}%`
);
console.log(
  `  exclusive/actual physical slope:        ${(derived.componentVsActualPhysical * 100).toFixed(1)}%`
);
console.log(
  '\nStandalone percentages are not additive when an arm includes shared node or payload objects.\n' +
    'The synthetic closure rows are the accounting test; index increments isolate shared-node Maps.'
);
