#!/usr/bin/env node
/**
 * ENTITY-PHYSICAL-DENSITY-0 / E1: external subject-record prototype.
 *
 * This benchmark does not import a candidate implementation into production.
 * It compares the current physical stores with staged synthetic layouts while
 * preserving stable SubjectId, key membership, value, revision, lifecycle,
 * ordering-node identity, and O(1) key/SubjectId lookup paths.
 *
 * Usage:
 *   node --expose-gc tools/bench-subject-record-consolidation.mjs
 *   node --expose-gc tools/bench-subject-record-consolidation.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-subject-record-consolidation.mjs');

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
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const E0_PHYSICAL_SLOPE = 393.9;

const entity = (index) => ({ id: index, name: `n${index}`, value: index });

const appendNode = (order, key, subjectId) => {
  const node = {
    key,
    subjectId,
    prev: order.tail,
    next: undefined,
  };
  if (order.tail === undefined) order.head = node;
  else order.tail.next = node;
  order.tail = node;
  return node;
};

const buildCurrent = (count) => {
  const structural = new StructuralStore();
  const values = new EntityValueStore();
  for (let index = 0; index < count; index++) {
    const subjectId = structural.allocateFreshSubjectId();
    structural.createSubject(subjectId, index);
    values.retainSubjectValue(subjectId, entity(index));
  }
  return { structural, values };
};

const buildConsolidated = (
  count,
  { activeByKey = true, activeBySubject = true } = {}
) => {
  const subjectIds = new Map();
  const subjects = new Map();
  const activeNodesByKey = activeByKey ? new Map() : undefined;
  const activeNodesBySubject = activeBySubject ? new Map() : undefined;
  const order = { head: undefined, tail: undefined };

  for (let index = 0; index < count; index++) {
    const subjectId = index + 1;
    const node = appendNode(order, index, subjectId);
    const record = {
      key: index,
      value: entity(index),
      revision: 0,
      active: true,
      restoreAllowed: true,
      activeNode: node,
    };
    subjectIds.set(index, subjectId);
    subjects.set(subjectId, record);
    activeNodesByKey?.set(index, node);
    activeNodesBySubject?.set(subjectId, node);
  }

  return {
    subjectIds,
    subjects,
    activeNodesByKey,
    activeNodesBySubject,
    activeHead: order.head,
    activeTail: order.tail,
    activeCount: count,
    nextSubjectId: count + 1,
    collectionIncarnation: 0,
  };
};

const nodeForKey = (store, key) => {
  if (store.activeNodesByKey !== undefined) {
    return store.activeNodesByKey.get(key);
  }
  const subjectId = store.subjectIds.get(key);
  return subjectId === undefined
    ? undefined
    : store.subjects.get(subjectId)?.activeNode;
};

const nodeForSubject = (store, subjectId) =>
  store.activeNodesBySubject?.get(subjectId) ??
  store.subjects.get(subjectId)?.activeNode;

const appendPrototypeNode = (store, key, subjectId) => {
  const node = {
    key,
    subjectId,
    prev: store.activeTail,
    next: undefined,
  };
  if (store.activeTail === undefined) store.activeHead = node;
  else store.activeTail.next = node;
  store.activeTail = node;
  return node;
};

const retirePrototypeSubject = (store, subjectId) => {
  const record = store.subjects.get(subjectId);
  const node = record?.activeNode;
  if (record === undefined || node === undefined) return;

  if (node.prev === undefined) store.activeHead = node.next;
  else node.prev.next = node.next;
  if (node.next === undefined) store.activeTail = node.prev;
  else node.next.prev = node.prev;
  store.subjectIds.delete(record.key);
  store.activeNodesByKey?.delete(record.key);
  store.activeNodesBySubject?.delete(subjectId);
  record.active = false;
  record.activeNode = undefined;
  store.activeCount -= 1;
};

const activatePrototypeSubject = (store, subjectId, key) => {
  const record = store.subjects.get(subjectId);
  if (record === undefined || record.active) {
    throw new Error(`cannot activate SubjectId ${String(subjectId)}`);
  }
  const node = appendPrototypeNode(store, key, subjectId);
  record.key = key;
  record.active = true;
  record.activeNode = node;
  store.subjectIds.set(key, subjectId);
  store.activeNodesByKey?.set(key, node);
  store.activeNodesBySubject?.set(subjectId, node);
  store.activeCount += 1;
};

const ARMS = {
  'actual-current': {
    description: 'production StructuralStore + EntityValueStore',
    build: buildCurrent,
  },
  'record-both-indexes': {
    description: 'one subject record; both active-node indexes retained',
    build: (count) => buildConsolidated(count),
  },
  'record-with-key-index': {
    description: 'record.activeNode replaces activeNodesBySubject',
    build: (count) =>
      buildConsolidated(count, { activeByKey: true, activeBySubject: false }),
  },
  'record-with-subject-index': {
    description: 'key -> SubjectId -> record replaces activeNodesByKey',
    build: (count) =>
      buildConsolidated(count, { activeByKey: false, activeBySubject: true }),
  },
  'record-no-active-indexes': {
    description: 'record lookup replaces both active-node indexes',
    build: (count) =>
      buildConsolidated(count, { activeByKey: false, activeBySubject: false }),
  },
};

const assertPrototypeLookups = (name, store) => {
  if (name === 'actual-current') return;

  const expectedOrder = [];
  for (let node = store.activeHead; node !== undefined; node = node.next) {
    expectedOrder.push(node.key);
    const record = store.subjects.get(node.subjectId);
    if (record?.activeNode !== node || record.key !== node.key) {
      throw new Error(`${name}: record does not own the canonical active node`);
    }
    if (nodeForKey(store, node.key) !== node) {
      throw new Error(`${name}: key lookup changed active-node identity`);
    }
    if (nodeForSubject(store, node.subjectId) !== node) {
      throw new Error(`${name}: SubjectId lookup changed active-node identity`);
    }
  }

  if (
    expectedOrder.length !== store.activeCount ||
    expectedOrder.some((key, index) => key !== index) ||
    (store.activeCount === 0
      ? store.activeTail !== undefined
      : store.activeTail?.key !== store.activeCount - 1)
  ) {
    throw new Error(`${name}: linked ordering is not preserved`);
  }
  if (nodeForKey(store, -1) !== undefined || nodeForSubject(store, 0) !== undefined) {
    throw new Error(`${name}: missing lookups must remain missing`);
  }
};

const assertPrototypeTransitions = (name, build) => {
  const store = build(3);
  const heldRecord = store.subjects.get(2);
  if (heldRecord === undefined) throw new Error(`${name}: missing held record`);

  heldRecord.value = { ...heldRecord.value, value: 99 };
  heldRecord.revision += 1;
  if (
    store.subjects.get(2) !== heldRecord ||
    heldRecord.value.value !== 99 ||
    heldRecord.revision !== 1
  ) {
    throw new Error(`${name}: update replaced identity or lost mutable facts`);
  }

  retirePrototypeSubject(store, 2);
  if (
    store.subjects.get(2) !== heldRecord ||
    heldRecord.active ||
    heldRecord.activeNode !== undefined ||
    nodeForKey(store, 1) !== undefined ||
    nodeForSubject(store, 2) !== undefined
  ) {
    throw new Error(`${name}: retirement broke held identity or active lookup`);
  }

  const freshSubjectId = store.nextSubjectId;
  store.nextSubjectId += 1;
  const freshNode = appendPrototypeNode(store, 1, freshSubjectId);
  const freshRecord = {
    key: 1,
    value: entity(10),
    revision: 0,
    active: true,
    restoreAllowed: true,
    activeNode: freshNode,
  };
  store.subjects.set(freshSubjectId, freshRecord);
  store.subjectIds.set(1, freshSubjectId);
  store.activeNodesByKey?.set(1, freshNode);
  store.activeNodesBySubject?.set(freshSubjectId, freshNode);
  store.activeCount += 1;
  if (
    nodeForKey(store, 1) !== freshNode ||
    store.subjects.get(2) !== heldRecord ||
    freshRecord === heldRecord
  ) {
    throw new Error(`${name}: fresh key occupant retargeted held identity`);
  }

  activatePrototypeSubject(store, 2, 20);
  if (
    store.subjects.get(2) !== heldRecord ||
    nodeForKey(store, 20) !== heldRecord.activeNode ||
    nodeForSubject(store, 2) !== heldRecord.activeNode
  ) {
    throw new Error(`${name}: reactivation changed identity or lookup`);
  }

  let activeCount = 0;
  let previous;
  for (let node = store.activeHead; node !== undefined; node = node.next) {
    if (node.prev !== previous) {
      throw new Error(`${name}: transition broke reverse ordering links`);
    }
    previous = node;
    activeCount += 1;
  }
  if (previous !== store.activeTail || activeCount !== store.activeCount) {
    throw new Error(`${name}: transition broke active ordering`);
  }
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${name}`);
  const result = await measureRetained(() => {
    const store = arm.build(size);
    assertPrototypeLookups(name, store);
    return store;
  }, { label: name });
  console.log(JSON.stringify({
    arm: name,
    n: size,
    description: arm.description,
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
  return {
    bytesPerEntity: numerator / denominator,
    fittedFixedBytes:
      meanBytes - (numerator / denominator) * meanN,
  };
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((n) => measureArm(name, n));
  return { ...points[0], description: arm.description, points, ...linearFit(points) };
});
for (const [name, arm] of Object.entries(ARMS)) {
  if (name !== 'actual-current') assertPrototypeTransitions(name, arm.build);
}
const byName = new Map(rows.map((row) => [row.arm, row]));
const currentSlope = byName.get('actual-current').bytesPerEntity;
const lowerControlBound = E0_PHYSICAL_SLOPE * 0.9;
const upperControlBound = E0_PHYSICAL_SLOPE * 1.1;
const problems = [];

if (currentSlope < lowerControlBound || currentSlope > upperControlBound) {
  problems.push(
    `production control ${currentSlope.toFixed(1)} B/entity does not reproduce E0 ${E0_PHYSICAL_SLOPE.toFixed(1)} B/entity within 10%`
  );
}
for (const row of rows) {
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.arm}@${point.n} did not collect`);
  }
}
if (problems.length > 0) {
  throw new Error(`E1 prototype failed:\n${problems.join('\n')}`);
}

const deltas = {
  subjectRecordConsolidation:
    currentSlope - byName.get('record-both-indexes').bytesPerEntity,
  removeSubjectActiveIndex:
    byName.get('record-both-indexes').bytesPerEntity -
    byName.get('record-with-key-index').bytesPerEntity,
  removeKeyActiveIndex:
    byName.get('record-both-indexes').bytesPerEntity -
    byName.get('record-with-subject-index').bytesPerEntity,
  removeBothActiveIndexes:
    byName.get('record-both-indexes').bytesPerEntity -
    byName.get('record-no-active-indexes').bytesPerEntity,
  totalCandidate:
    currentSlope - byName.get('record-no-active-indexes').bytesPerEntity,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows, deltas }, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nENTITY-PHYSICAL-DENSITY-0 / E1');
console.log(`retained heap after quiescence; ${SAMPLES} isolated samples per arm and size\n`);
console.log(
  'arm'.padEnd(31) +
    SIZES.map((n) => String(n).padStart(11)).join('') +
    '   B/entity   vs current'
);
console.log('-'.repeat(101));
for (const row of rows) {
  console.log(
    row.arm.padEnd(31) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      row.bytesPerEntity.toFixed(1).padStart(11) +
      (row.bytesPerEntity - currentSlope).toFixed(1).padStart(13)
  );
  console.log(`  ${row.description}`);
}

console.log('\nMeasured marginal savings');
for (const [name, bytes] of Object.entries(deltas)) {
  console.log(`  ${name.padEnd(30)} ${bytes.toFixed(1).padStart(7)} B/entity`);
}
console.log(
  '\nAll candidate arms preserve linked-node identity, in-place updates, retirement, held identity, fresh key occupation, and reactivation through O(1) Map lookup paths.\n' +
    'This is external representation evidence only; it authorizes no production change.'
);
