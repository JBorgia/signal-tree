#!/usr/bin/env node
/**
 * ENTITY-PHYSICAL-DENSITY-0 / E2: active/retired lifetime compaction.
 *
 * External representation prototype only. Common active records carry no
 * explicit lifetime object. A strong SubjectId-indexed overflow owns uncommon
 * retired/restorable state. Restoration claims remain a separate optional
 * capability cost so this row does not fold E5 into the physical baseline.
 *
 * Usage:
 *   node --expose-gc tools/bench-active-retired-lifetime.mjs
 *   node --expose-gc tools/bench-active-retired-lifetime.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-active-retired-lifetime.mjs');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const E1_CANDIDATE_SLOPE = 272.7;

const entity = (index, value = index) => ({
  id: index,
  name: `n${index}`,
  value,
});

const appendNode = (store, key, subjectId) => {
  const node = {
    key,
    subjectId,
    prev: store.activeTail,
    next: undefined,
  };
  if (store.activeTail === undefined) store.activeHead = node;
  else store.activeTail.next = node;
  store.activeTail = node;
  store.activeCount += 1;
  return node;
};

const detachNode = (store, node) => {
  if (node.prev === undefined) store.activeHead = node.next;
  else node.prev.next = node.next;
  if (node.next === undefined) store.activeTail = node.prev;
  else node.next.prev = node.prev;
  node.prev = undefined;
  node.next = undefined;
  store.activeCount -= 1;
};

const createStore = () => ({
  subjectIds: new Map(),
  subjects: new Map(),
  exceptionalLifetimes: new Map(),
  activeHead: undefined,
  activeTail: undefined,
  activeCount: 0,
  nextSubjectId: 1,
});

const createActiveSubject = (store, key, value = entity(key)) => {
  const subjectId = store.nextSubjectId;
  store.nextSubjectId += 1;
  const activeNode = appendNode(store, key, subjectId);
  const record = { key, value, revision: 0, activeNode };
  store.subjectIds.set(key, subjectId);
  store.subjects.set(subjectId, record);
  return { subjectId, record };
};

const retireSubject = (
  store,
  subjectId,
  { restoreAllowed = false, held = false } = {}
) => {
  const record = store.subjects.get(subjectId);
  if (record === undefined || record.activeNode === undefined) {
    throw new Error(`cannot retire SubjectId ${String(subjectId)}`);
  }
  const retiredKey = record.key;
  detachNode(store, record.activeNode);
  store.subjectIds.delete(retiredKey);
  record.activeNode = undefined;
  store.exceptionalLifetimes.set(subjectId, {
    kind: held ? 'held-retired' : restoreAllowed ? 'restorable' : 'retired',
    restoreAllowed,
    retiredKey,
  });
  return record;
};

const restoreSubjectBefore = (
  store,
  subjectId,
  key,
  beforeSubjectId,
  compactEmptyOverflow = true
) => {
  const record = store.subjects.get(subjectId);
  const lifetime = store.exceptionalLifetimes.get(subjectId);
  if (record === undefined || lifetime?.restoreAllowed !== true) {
    throw new Error(`cannot restore SubjectId ${String(subjectId)}`);
  }
  const occupyingSubjectId = store.subjectIds.get(key);
  if (
    occupyingSubjectId !== undefined &&
    occupyingSubjectId !== subjectId
  ) {
    throw new Error(`cannot restore into occupied key ${String(key)}`);
  }

  const beforeNode = store.subjects.get(beforeSubjectId)?.activeNode;
  const node = { key, subjectId, prev: undefined, next: beforeNode };
  if (beforeNode === undefined) {
    node.prev = store.activeTail;
    if (store.activeTail === undefined) store.activeHead = node;
    else store.activeTail.next = node;
    store.activeTail = node;
  } else {
    node.prev = beforeNode.prev;
    if (beforeNode.prev === undefined) store.activeHead = node;
    else beforeNode.prev.next = node;
    beforeNode.prev = node;
  }
  store.activeCount += 1;
  record.key = key;
  record.activeNode = node;
  store.subjectIds.set(key, subjectId);
  store.exceptionalLifetimes.delete(subjectId);
  if (compactEmptyOverflow && store.exceptionalLifetimes.size === 0) {
    store.exceptionalLifetimes = new Map();
  }
};

const rekeySubject = (store, subjectId, nextKey) => {
  const record = store.subjects.get(subjectId);
  if (record?.activeNode === undefined) {
    throw new Error(`cannot rekey SubjectId ${String(subjectId)}`);
  }
  store.subjectIds.delete(record.key);
  record.key = nextKey;
  record.activeNode.key = nextKey;
  store.subjectIds.set(nextKey, subjectId);
};

const buildE1Control = (count) => {
  const subjectIds = new Map();
  const subjects = new Map();
  const order = { activeHead: undefined, activeTail: undefined, activeCount: 0 };
  for (let index = 0; index < count; index++) {
    const subjectId = index + 1;
    const activeNode = appendNode(order, index, subjectId);
    subjectIds.set(index, subjectId);
    subjects.set(subjectId, {
      key: index,
      value: entity(index),
      revision: 0,
      active: true,
      restoreAllowed: true,
      activeNode,
    });
  }
  return { subjectIds, subjects, ...order };
};

const buildCompactActive = (count, mutate = false) => {
  const store = createStore();
  for (let index = 0; index < count; index++) {
    const { record } = createActiveSubject(store, index);
    if (mutate) {
      record.value = entity(index, index + 1);
      record.revision += 1;
    }
  }
  return store;
};

const buildKeyChurnControl = (count) => {
  const store = buildCompactActive(count);
  for (let index = 0; index < count; index++) {
    const subjectId = store.subjectIds.get(index);
    store.subjectIds.delete(index);
    store.subjectIds.set(index, subjectId);
  }
  return store;
};

const buildRetired = (count, options) => {
  const store = createStore();
  const heldRecords = options?.held ? [] : undefined;
  for (let index = 0; index < count; index++) {
    const { subjectId, record } = createActiveSubject(store, index);
    retireSubject(store, subjectId, options);
    heldRecords?.push(record);
  }
  return { ...store, heldRecords };
};

const buildRetiredWithoutLifetimeControl = (count) => {
  const store = buildRetired(count);
  store.exceptionalLifetimes = new Map();
  return store;
};

const buildClaimedRetired = (count) => {
  const store = buildRetired(count, { restoreAllowed: true });
  const owner = 'restoration:1';
  const ownerSubjects = new Set();
  const ownersBySubject = new Map();
  for (let subjectId = 1; subjectId <= count; subjectId++) {
    ownerSubjects.add(subjectId);
    ownersBySubject.set(subjectId, new Set([owner]));
  }
  return {
    ...store,
    claims: {
      byOwner: new Map([[owner, ownerSubjects]]),
      bySubject: ownersBySubject,
    },
  };
};

const buildReactivated = (count, compactEmptyOverflow = true) => {
  const store = createStore();
  for (let index = 0; index < count; index++) {
    const { subjectId } = createActiveSubject(store, index);
    retireSubject(store, subjectId, { restoreAllowed: true });
    restoreSubjectBefore(
      store,
      subjectId,
      index,
      Number.MAX_SAFE_INTEGER,
      compactEmptyOverflow
    );
  }
  return store;
};

const buildFreshOccupants = (count) => {
  const store = createStore();
  const heldRetired = [];
  for (let index = 0; index < count; index++) {
    const first = createActiveSubject(store, index);
    retireSubject(store, first.subjectId, { held: true });
    heldRetired.push(first.record);
    createActiveSubject(store, index, entity(index, index + 1));
  }
  return { ...store, heldRetired };
};

const ARMS = {
  'e1-active-control': {
    population: 'never-retired active, explicit lifetime fields',
    unit: 'entity',
    build: buildE1Control,
  },
  'compact-active': {
    population: 'never-retired active, lifetime implicit',
    unit: 'entity',
    build: buildCompactActive,
  },
  'mutated-active': {
    population: 'updated active, lifetime still implicit',
    unit: 'entity',
    build: (count) => buildCompactActive(count, true),
  },
  'active-key-churn-control': {
    population: 'compact active after key-index delete/reinsert',
    unit: 'entity',
    build: buildKeyChurnControl,
  },
  'retired-unclaimed': {
    population: 'retired, strong exceptional state, no claim',
    unit: 'retired subject',
    build: (count) => buildRetired(count),
  },
  'retired-no-lifetime-control': {
    population: 'attribution only: retired shape without required lifetime truth',
    unit: 'retired subject',
    build: buildRetiredWithoutLifetimeControl,
  },
  'retired-claimed': {
    population: 'restorable retired plus synthetic production-shaped claim graph',
    unit: 'claimed retired subject',
    build: buildClaimedRetired,
  },
  'held-retired': {
    population: 'retired plus an external strong held reference',
    unit: 'held retired subject',
    build: (count) => buildRetired(count, { held: true }),
  },
  reactivated: {
    population: 'same SubjectId restored; empty overflow Map replaced',
    unit: 'entity',
    build: buildReactivated,
  },
  'reactivated-retained-capacity': {
    population: 'same SubjectId restored; emptied overflow Map retains capacity',
    unit: 'entity',
    build: (count) => buildReactivated(count, false),
  },
  'fresh-reused-key': {
    population: 'one held retired subject plus fresh same-key occupant',
    unit: 'old/new pair',
    build: buildFreshOccupants,
  },
};

const assertOrder = (store, expectedKeys) => {
  const actualKeys = [];
  let previous;
  for (let node = store.activeHead; node !== undefined; node = node.next) {
    if (node.prev !== previous) throw new Error('broken reverse ordering link');
    if (store.subjectIds.get(node.key) !== node.subjectId) {
      throw new Error('key does not address ordered SubjectId');
    }
    if (store.subjects.get(node.subjectId)?.activeNode !== node) {
      throw new Error('SubjectId does not address ordered node');
    }
    actualKeys.push(node.key);
    previous = node;
  }
  if (
    previous !== store.activeTail ||
    actualKeys.length !== store.activeCount ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error(`unexpected order: ${actualKeys.join(',')}`);
  }
};

const assertSemanticControls = () => {
  const store = createStore();
  const first = createActiveSubject(store, 1);
  const second = createActiveSubject(store, 2);
  const third = createActiveSubject(store, 3);
  if (store.exceptionalLifetimes.size !== 0) {
    throw new Error('common active subjects allocated exceptional lifetime state');
  }

  const heldRecord = second.record;
  heldRecord.value = entity(2, 20);
  heldRecord.revision += 1;
  if (store.subjects.get(second.subjectId) !== heldRecord) {
    throw new Error('active mutation replaced stable subject identity');
  }

  retireSubject(store, second.subjectId, { restoreAllowed: true, held: true });
  if (
    store.subjects.get(second.subjectId) !== heldRecord ||
    heldRecord.activeNode !== undefined ||
    store.subjectIds.has(2) ||
    store.exceptionalLifetimes.get(second.subjectId)?.kind !== 'held-retired'
  ) {
    throw new Error('retirement lost held identity or exceptional state');
  }

  const fresh = createActiveSubject(store, 2, entity(2, 200));
  if (
    fresh.subjectId === second.subjectId ||
    store.subjectIds.get(2) !== fresh.subjectId ||
    store.subjects.get(second.subjectId) !== heldRecord
  ) {
    throw new Error('fresh same-key occupant reused or retargeted SubjectId');
  }

  rekeySubject(store, third.subjectId, 30);
  if (
    store.subjectIds.has(3) ||
    store.subjectIds.get(30) !== third.subjectId ||
    third.record.activeNode?.key !== 30
  ) {
    throw new Error('constant-hop Map rekey path lost record or ordering identity');
  }

  let rejectedOccupiedRestore = false;
  try {
    restoreSubjectBefore(store, second.subjectId, 2, third.subjectId);
  } catch {
    rejectedOccupiedRestore = true;
  }
  if (
    !rejectedOccupiedRestore ||
    store.subjectIds.get(2) !== fresh.subjectId ||
    heldRecord.activeNode !== undefined ||
    !store.exceptionalLifetimes.has(second.subjectId)
  ) {
    throw new Error('occupied-key restore changed canonical subject state');
  }

  restoreSubjectBefore(store, second.subjectId, 20, third.subjectId);
  if (
    store.subjects.get(second.subjectId) !== heldRecord ||
    store.exceptionalLifetimes.has(second.subjectId) ||
    store.subjectIds.get(20) !== second.subjectId
  ) {
    throw new Error('restoration did not resolve the exact retired subject');
  }
  assertOrder(store, [1, 20, 30, 2]);

  if (
    first.record.activeNode === undefined ||
    fresh.record.activeNode === undefined ||
    heldRecord.activeNode === undefined
  ) {
    throw new Error('active canonical truth was dropped');
  }
};

assertSemanticControls();

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${name}`);
  const result = await measureRetained(() => arm.build(size), { label: name });
  console.log(JSON.stringify({
    arm: name,
    n: size,
    population: arm.population,
    unit: arm.unit,
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
  return numerator / denominator;
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((n) => measureArm(name, n));
  return { ...points[0], population: arm.population, unit: arm.unit, points,
    bytesPerUnit: linearFit(points) };
});
const byName = new Map(rows.map((row) => [row.arm, row]));
const controlSlope = byName.get('e1-active-control').bytesPerUnit;
const compactSlope = byName.get('compact-active').bytesPerUnit;
const problems = [];

if (
  controlSlope < E1_CANDIDATE_SLOPE * 0.9 ||
  controlSlope > E1_CANDIDATE_SLOPE * 1.1
) {
  problems.push(
    `E1 control ${controlSlope.toFixed(1)} B/entity does not reproduce ${E1_CANDIDATE_SLOPE.toFixed(1)} within 10%`
  );
}
if (Math.abs(byName.get('mutated-active').bytesPerUnit - compactSlope) > 4) {
  problems.push('active mutation created a material lifetime slope');
}
const reactivatedSlope = byName.get('reactivated').bytesPerUnit;
const keyChurnSlope = byName.get('active-key-churn-control').bytesPerUnit;
if (Math.abs(reactivatedSlope - keyChurnSlope) > 4) {
  problems.push(
    `reactivation retains density beyond key-index churn (${reactivatedSlope.toFixed(1)} vs ${keyChurnSlope.toFixed(1)} B/entity)`
  );
}
for (const row of rows) {
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.arm}@${point.n} did not collect`);
  }
}
if (problems.length > 0) {
  throw new Error(`E2 prototype failed:\n${problems.join('\n')}`);
}

const derived = {
  commonActiveSaving: controlSlope - compactSlope,
  mutationIncrement: byName.get('mutated-active').bytesPerUnit - compactSlope,
  retiredUnclaimedDelta:
    byName.get('retired-unclaimed').bytesPerUnit - compactSlope,
  exceptionalLifetimeIncrement:
    byName.get('retired-unclaimed').bytesPerUnit -
    byName.get('retired-no-lifetime-control').bytesPerUnit,
  heldReferenceIncrement:
    byName.get('held-retired').bytesPerUnit -
    byName.get('retired-unclaimed').bytesPerUnit,
  syntheticClaimGraphIncrement:
    byName.get('retired-claimed').bytesPerUnit -
    byName.get('retired-unclaimed').bytesPerUnit,
  keyChurnIncrement: keyChurnSlope - compactSlope,
  reactivationBeyondKeyChurn: reactivatedSlope - keyChurnSlope,
  retainedOverflowCapacitySlope:
    byName.get('reactivated-retained-capacity').bytesPerUnit -
    reactivatedSlope,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows, derived }, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nENTITY-PHYSICAL-DENSITY-0 / E2');
console.log(`retained heap after quiescence; ${SAMPLES} isolated samples per arm and size\n`);
console.log(
  'population'.padEnd(27) +
    SIZES.map((n) => String(n).padStart(11)).join('') +
    '      B/unit'
);
console.log('-'.repeat(84));
for (const row of rows) {
  console.log(
    row.arm.padEnd(27) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      row.bytesPerUnit.toFixed(1).padStart(12)
  );
  console.log(`  ${row.population}; unit: ${row.unit}`);
}

console.log('\nPopulation deltas');
for (const [name, bytes] of Object.entries(derived)) {
  console.log(`  ${name.padEnd(29)} ${bytes.toFixed(1).padStart(7)} B/unit`);
}
console.log(
  '\nExceptional lifetime state is strongly owned and absent for common active records.\n' +
    'The claim-graph arm measures one concrete representation, not an abstract semantic minimum.\n' +
    'Lookup controls exercise constant-hop Map paths; this prototype authorizes no production change.'
);
