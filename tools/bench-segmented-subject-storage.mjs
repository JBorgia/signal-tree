#!/usr/bin/env node
/**
 * ENTITY-PHYSICAL-DENSITY-0 / E3: numeric SubjectId storage prototype.
 *
 * External representation evidence only. SubjectIds are monotonic and never
 * reused. Numeric addressing derives a segment and offset directly from the
 * SubjectId; no SubjectId -> physical-slot index is hidden underneath.
 *
 * Usage:
 *   node --expose-gc tools/bench-segmented-subject-storage.mjs
 *   node --expose-gc tools/bench-segmented-subject-storage.mjs --samples 1
 *   node --expose-gc tools/bench-segmented-subject-storage.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { measureRetained, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-segmented-subject-storage.mjs');

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SEGMENT_SHIFT = 10;
const SEGMENT_SIZE = 1 << SEGMENT_SHIFT;
const MEMORY_SIZES = [0, 1_000, 10_000, 100_000];
const MEMORY_SAMPLES = Number(argument('--samples', 3));
const LATENCY_SAMPLES = Number(argument('--latency-samples', 15));
const LATENCY_OPERATIONS = Number(argument('--latency-operations', 500_000));
const size = Number(argument('--n', 10_000));
const E2_COMPACT_SLOPE = 256.6;

const assertSubjectId = (subjectId) => {
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw new RangeError(`SubjectId must be a positive safe integer: ${String(subjectId)}`);
  }
};
const segmentIndex = (subjectId) => {
  assertSubjectId(subjectId);
  return Math.floor((subjectId - 1) / SEGMENT_SIZE);
};
const segmentOffset = (subjectId) => {
  assertSubjectId(subjectId);
  return (subjectId - 1) % SEGMENT_SIZE;
};
const maxSubjectId = Number.MAX_SAFE_INTEGER;
if (
  segmentIndex(maxSubjectId) * SEGMENT_SIZE + segmentOffset(maxSubjectId) + 1 !==
  maxSubjectId
) {
  throw new Error('safe-integer SubjectId addressing lost identity');
}
for (const invalidSubjectId of [0, -1, Number.MAX_SAFE_INTEGER + 1]) {
  try {
    segmentIndex(invalidSubjectId);
    throw new Error(`invalid SubjectId was accepted: ${String(invalidSubjectId)}`);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
  }
}
const valueFor = (subjectId, revision = 0) => ({
  id: subjectId,
  name: `n${subjectId}`,
  value: revision,
});

class MapSubjectStorage {
  records = new Map();

  set(subjectId, record) { this.records.set(subjectId, record); }
  get(subjectId) { return this.records.get(subjectId); }
  delete(subjectId) { return this.records.delete(subjectId); }
  update(subjectId, value, revision) {
    const record = this.records.get(subjectId);
    if (record === undefined) return false;
    record.value = value;
    record.revision = revision;
    return true;
  }
  readChecksum(subjectId) {
    const record = this.records.get(subjectId);
    return record === undefined
      ? 0
      : record.key + record.value.value + record.revision + record.activeNode.subjectId;
  }
  iterateChecksum() {
    let checksum = 0;
    for (const record of this.records.values()) checksum += record.revision;
    return checksum;
  }
  stats() { return { segments: 0, capacitySlots: this.records.size }; }
}

class ChunkedObjectArrayStorage {
  segments = [];
  counts = [];

  set(subjectId, record) {
    const index = segmentIndex(subjectId);
    const offset = segmentOffset(subjectId);
    let segment = this.segments[index];
    if (segment === undefined) {
      segment = new Array(SEGMENT_SIZE);
      this.segments[index] = segment;
      this.counts[index] = 0;
    }
    if (segment[offset] === undefined) this.counts[index] += 1;
    segment[offset] = record;
  }
  get(subjectId) {
    return this.segments[segmentIndex(subjectId)]?.[segmentOffset(subjectId)];
  }
  delete(subjectId) {
    const index = segmentIndex(subjectId);
    const segment = this.segments[index];
    const offset = segmentOffset(subjectId);
    if (segment?.[offset] === undefined) return false;
    segment[offset] = undefined;
    this.counts[index] -= 1;
    return true;
  }
  update(subjectId, value, revision) {
    const record = this.get(subjectId);
    if (record === undefined) return false;
    record.value = value;
    record.revision = revision;
    return true;
  }
  readChecksum(subjectId) {
    const record = this.get(subjectId);
    return record === undefined
      ? 0
      : record.key + record.value.value + record.revision + record.activeNode.subjectId;
  }
  iterateChecksum() {
    let checksum = 0;
    for (const segment of this.segments) {
      if (segment === undefined) continue;
      for (const record of segment) {
        if (record !== undefined) checksum += record.revision;
      }
    }
    return checksum;
  }
  stats() {
    const segments = this.segments.filter(Boolean).length;
    return { segments, capacitySlots: segments * SEGMENT_SIZE };
  }
}

class SparseObjectSegmentStorage {
  segments = new Map();

  set(subjectId, record) {
    const index = segmentIndex(subjectId);
    const offset = segmentOffset(subjectId);
    let segment = this.segments.get(index);
    if (segment === undefined) {
      segment = { records: new Array(SEGMENT_SIZE), count: 0 };
      this.segments.set(index, segment);
    }
    if (segment.records[offset] === undefined) segment.count += 1;
    segment.records[offset] = record;
  }
  get(subjectId) {
    return this.segments.get(segmentIndex(subjectId))?.records[segmentOffset(subjectId)];
  }
  delete(subjectId) {
    const index = segmentIndex(subjectId);
    const segment = this.segments.get(index);
    const offset = segmentOffset(subjectId);
    if (segment?.records[offset] === undefined) return false;
    segment.records[offset] = undefined;
    segment.count -= 1;
    if (segment.count === 0) this.segments.delete(index);
    return true;
  }
  update(subjectId, value, revision) {
    const record = this.get(subjectId);
    if (record === undefined) return false;
    record.value = value;
    record.revision = revision;
    return true;
  }
  readChecksum(subjectId) {
    const record = this.get(subjectId);
    return record === undefined
      ? 0
      : record.key + record.value.value + record.revision + record.activeNode.subjectId;
  }
  iterateChecksum() {
    let checksum = 0;
    for (const segment of this.segments.values()) {
      for (const record of segment.records) {
        if (record !== undefined) checksum += record.revision;
      }
    }
    return checksum;
  }
  stats() {
    return { segments: this.segments.size, capacitySlots: this.segments.size * SEGMENT_SIZE };
  }
}

class PackedRecordHandle {
  constructor(storage, subjectId) {
    this.storage = storage;
    this.subjectId = subjectId;
  }
  get key() { return this.storage.keyFor(this.subjectId); }
  get value() { return this.storage.valueFor(this.subjectId); }
  get revision() { return this.storage.revisionFor(this.subjectId); }
  get activeNode() { return this.storage.nodeFor(this.subjectId); }
}

class PackedSegmentStorage {
  segments = new Map();

  createSegment() {
    return {
      keys: new Float64Array(SEGMENT_SIZE),
      values: new Array(SEGMENT_SIZE),
      revisions: new Float64Array(SEGMENT_SIZE),
      nodes: new Array(SEGMENT_SIZE),
      handles: new Array(SEGMENT_SIZE),
      present: new Uint8Array(SEGMENT_SIZE),
      count: 0,
    };
  }
  set(subjectId, record) {
    const index = segmentIndex(subjectId);
    const offset = segmentOffset(subjectId);
    let segment = this.segments.get(index);
    if (segment === undefined) {
      segment = this.createSegment();
      this.segments.set(index, segment);
    }
    if (segment.present[offset] === 0) {
      segment.present[offset] = 1;
      segment.count += 1;
    }
    segment.keys[offset] = record.key;
    segment.values[offset] = record.value;
    segment.revisions[offset] = record.revision;
    segment.nodes[offset] = record.activeNode;
    if (segment.handles[offset] === undefined) {
      segment.handles[offset] = new PackedRecordHandle(this, subjectId);
    }
  }
  get(subjectId) {
    const segment = this.segments.get(segmentIndex(subjectId));
    const offset = segmentOffset(subjectId);
    if (segment === undefined || segment.present[offset] === 0) return undefined;
    return segment.handles[offset];
  }
  keyFor(subjectId) {
    return this.segments.get(segmentIndex(subjectId))?.keys[segmentOffset(subjectId)];
  }
  valueFor(subjectId) {
    return this.segments.get(segmentIndex(subjectId))?.values[segmentOffset(subjectId)];
  }
  revisionFor(subjectId) {
    return this.segments.get(segmentIndex(subjectId))?.revisions[segmentOffset(subjectId)];
  }
  nodeFor(subjectId) {
    return this.segments.get(segmentIndex(subjectId))?.nodes[segmentOffset(subjectId)];
  }
  delete(subjectId) {
    const index = segmentIndex(subjectId);
    const segment = this.segments.get(index);
    const offset = segmentOffset(subjectId);
    if (segment === undefined || segment.present[offset] === 0) return false;
    segment.present[offset] = 0;
    segment.values[offset] = undefined;
    segment.nodes[offset] = undefined;
    segment.handles[offset] = undefined;
    segment.count -= 1;
    if (segment.count === 0) this.segments.delete(index);
    return true;
  }
  update(subjectId, value, revision) {
    const segment = this.segments.get(segmentIndex(subjectId));
    const offset = segmentOffset(subjectId);
    if (segment === undefined || segment.present[offset] === 0) return false;
    segment.values[offset] = value;
    segment.revisions[offset] = revision;
    return true;
  }
  readChecksum(subjectId) {
    const segment = this.segments.get(segmentIndex(subjectId));
    const offset = segmentOffset(subjectId);
    if (segment === undefined || segment.present[offset] === 0) return 0;
    return segment.keys[offset] + segment.values[offset].value +
      segment.revisions[offset] + segment.nodes[offset].subjectId;
  }
  iterateChecksum() {
    let checksum = 0;
    for (const segment of this.segments.values()) {
      for (let offset = 0; offset < SEGMENT_SIZE; offset++) {
        if (segment.present[offset] !== 0) checksum += segment.revisions[offset];
      }
    }
    return checksum;
  }
  stats() {
    return { segments: this.segments.size, capacitySlots: this.segments.size * SEGMENT_SIZE };
  }
}

const VARIANTS = {
  map: () => new MapSubjectStorage(),
  chunked: () => new ChunkedObjectArrayStorage(),
  sparse: () => new SparseObjectSegmentStorage(),
  packed: () => new PackedSegmentStorage(),
};

const createLayout = (storage) => ({
  subjectIds: new Map(),
  storage,
  activeHead: undefined,
  activeTail: undefined,
  activeCount: 0,
  nextSubjectId: 1,
});

const appendLiveSubject = (layout, subjectId) => {
  const key = subjectId;
  const node = { key, subjectId, prev: layout.activeTail, next: undefined };
  if (layout.activeTail === undefined) layout.activeHead = node;
  else layout.activeTail.next = node;
  layout.activeTail = node;
  layout.activeCount += 1;
  layout.subjectIds.set(key, subjectId);
  layout.storage.set(subjectId, {
    key,
    value: valueFor(subjectId),
    revision: 0,
    activeNode: node,
  });
  layout.nextSubjectId = Math.max(layout.nextSubjectId, subjectId + 1);
};

const populateIds = (variant, ids) => {
  const layout = createLayout(VARIANTS[variant]());
  for (const subjectId of ids) appendLiveSubject(layout, subjectId);
  return layout;
};

const rebindStoredRecords = (storage, layout, subjectIds) => {
  for (const subjectId of subjectIds) {
    const canonicalRecord = layout.storage.get(subjectId);
    storage.set(subjectId, canonicalRecord);
  }
};

const denseIds = (count) => Array.from({ length: count }, (_, index) => index + 1);
const randomSparseIds = (count) => {
  const highWater = count * 10;
  const ids = new Set();
  let state = 0x9e3779b9;
  while (ids.size < count) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    ids.add((state % highWater) + 1);
  }
  return [...ids];
};
const clusteredHighIds = (count) =>
  Array.from({ length: count }, (_, index) => count * 9 + index + 1);

const buildScenario = (variant, scenario, count) => {
  if (scenario === 'dense') return populateIds(variant, denseIds(count));
  if (scenario === 'sparse-random-direct') {
    return populateIds(variant, randomSparseIds(count));
  }
  if (scenario === 'sparse-random') {
    const storage = VARIANTS[variant]();
    const highWater = count * 10;
    for (let subjectId = 1; subjectId <= highWater; subjectId++) {
      storage.set(subjectId, {
        key: subjectId,
        value: valueFor(subjectId),
        revision: 0,
        activeNode: { key: subjectId, subjectId },
      });
    }
    const survivors = new Set(randomSparseIds(count));
    for (let subjectId = 1; subjectId <= highWater; subjectId++) {
      if (!survivors.has(subjectId)) storage.delete(subjectId);
    }
    const layout = populateIds(variant, [...survivors]);
    rebindStoredRecords(storage, layout, survivors);
    layout.storage = storage;
    layout.nextSubjectId = highWater + 1;
    return layout;
  }
  if (scenario === 'sparse-clustered') {
    const storage = VARIANTS[variant]();
    const highWater = count * 10;
    for (let subjectId = 1; subjectId <= highWater; subjectId++) {
      storage.set(subjectId, {
        key: subjectId,
        value: valueFor(subjectId),
        revision: 0,
        activeNode: { key: subjectId, subjectId },
      });
    }
    for (let subjectId = 1; subjectId <= highWater - count; subjectId++) {
      storage.delete(subjectId);
    }
    const layout = populateIds(variant, clusteredHighIds(count));
    rebindStoredRecords(storage, layout, clusteredHighIds(count));
    layout.storage = storage;
    layout.nextSubjectId = highWater + 1;
    return layout;
  }
  if (scenario === 'repeated-high-water') {
    const storage = VARIANTS[variant]();
    const cycles = 10;
    for (let cycle = 0; cycle < cycles; cycle++) {
      const start = cycle * count + 1;
      for (let offset = 0; offset < count; offset++) {
        const subjectId = start + offset;
        storage.set(subjectId, {
          key: subjectId,
          value: valueFor(subjectId),
          revision: 0,
          activeNode: { key: subjectId, subjectId },
        });
      }
      if (cycle < cycles - 1) {
        for (let offset = 0; offset < count; offset++) storage.delete(start + offset);
      }
    }
    const ids = clusteredHighIds(count);
    const layout = populateIds(variant, ids);
    rebindStoredRecords(storage, layout, ids);
    layout.storage = storage;
    layout.nextSubjectId = count * cycles + 1;
    return layout;
  }
  if (scenario === 'held-old') {
    if (count === 0) return populateIds(variant, []);
    const newest = clusteredHighIds(count);
    const layout = populateIds(variant, [1, ...newest]);
    layout.heldOldSubjectId = 1;
    return layout;
  }
  if (scenario === 'mixed-restoration-retained') {
    const layout = createLayout(VARIANTS[variant]());
    layout.restorationRetainedSubjectIds = [];
    for (let subjectId = 1; subjectId <= count; subjectId++) {
      if (subjectId % 2 === 0) {
        appendLiveSubject(layout, subjectId);
      } else {
        layout.storage.set(subjectId, {
          key: subjectId,
          value: valueFor(subjectId),
          revision: 0,
          activeNode: undefined,
        });
        layout.restorationRetainedSubjectIds.push(subjectId);
        layout.nextSubjectId = subjectId + 1;
      }
    }
    return layout;
  }
  throw new Error(`unknown scenario: ${scenario}`);
};

const assertLayout = (layout, scenario, count) => {
  let previous;
  let activeCount = 0;
  for (let node = layout.activeHead; node !== undefined; node = node.next) {
    if (node.prev !== previous) throw new Error(`${scenario}: reverse link broken`);
    if (layout.subjectIds.get(node.key) !== node.subjectId) {
      throw new Error(`${scenario}: key changed SubjectId address`);
    }
    const record = layout.storage.get(node.subjectId);
    if (
      record?.key !== node.key ||
      record.activeNode !== node ||
      layout.storage.get(node.subjectId) !== record
    ) {
      throw new Error(`${scenario}: SubjectId changed stable record or node identity`);
    }
    previous = node;
    activeCount += 1;
  }
  if (previous !== layout.activeTail || activeCount !== layout.activeCount) {
    throw new Error(`${scenario}: order/count mismatch`);
  }
  if (scenario === 'held-old' && count > 0) {
    if (layout.storage.get(1)?.value.id !== 1 || layout.nextSubjectId <= count * 9) {
      throw new Error('held old subject lost while newer SubjectIds grew');
    }
  }
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const [variant, scenario] = process.argv[armIndex + 1].split(':');
  if (VARIANTS[variant] === undefined) throw new Error(`unknown variant: ${variant}`);
  const result = await measureRetained(() => {
    const layout = buildScenario(variant, scenario, size);
    assertLayout(layout, scenario, size);
    return layout;
  }, { label: `${variant}:${scenario}` });
  const layout = buildScenario(variant, scenario, size);
  console.log(JSON.stringify({
    variant,
    scenario,
    n: size,
    retainedSubjects: size + (scenario === 'held-old' && size > 0 ? 1 : 0),
    highWaterSubjectId: layout.nextSubjectId - 1,
    retainedBytes: result.retainedBytes,
    collectable: result.collectable,
    ...layout.storage.stats(),
  }));
  process.exit(0);
}

const measureOnce = (variant, scenario, n) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--arm',
      `${variant}:${scenario}`,
      '--n',
      String(n),
    ],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const measurePoint = (variant, scenario, n) => {
  const samples = Array.from(
    { length: MEMORY_SAMPLES },
    () => measureOnce(variant, scenario, n)
  );
  return samples.sort((left, right) => left.retainedBytes - right.retainedBytes)[
    Math.floor(samples.length / 2)
  ];
};

const linearFit = (points) => {
  const used = points.filter((point) => point.n > 0);
  const meanN = used.reduce((sum, point) => sum + point.retainedSubjects, 0) / used.length;
  const meanBytes = used.reduce((sum, point) => sum + point.retainedBytes, 0) / used.length;
  const numerator = used.reduce(
    (sum, point) => sum + (point.retainedSubjects - meanN) * (point.retainedBytes - meanBytes),
    0
  );
  const denominator = used.reduce(
    (sum, point) => sum + (point.retainedSubjects - meanN) ** 2,
    0
  );
  return {
    bytesPerRetainedSubject: numerator / denominator,
    fittedFixedBytes: meanBytes - (numerator / denominator) * meanN,
  };
};

const SCENARIOS = [
  'dense',
  'sparse-random-direct',
  'sparse-random',
  'sparse-clustered',
  'repeated-high-water',
  'held-old',
  'mixed-restoration-retained',
];
const memoryRows = [];
for (const variant of Object.keys(VARIANTS)) {
  for (const scenario of SCENARIOS) {
    const points = MEMORY_SIZES.map((n) => measurePoint(variant, scenario, n));
    memoryRows.push({ variant, scenario, points, ...linearFit(points) });
  }
}

const pseudoRandomIds = (count, max) => {
  let state = 0x9e3779b9;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state % max) + 1;
  });
};

const latencyCases = [];
const latencyN = 100_000;
let sink = 0;
for (const variant of Object.keys(VARIANTS)) {
  for (const population of ['dense', 'sparse-random']) {
    const storage = VARIANTS[variant]();
    const retainedIds = population === 'dense'
      ? denseIds(latencyN)
      : randomSparseIds(latencyN);
    for (const subjectId of retainedIds) {
      storage.set(subjectId, {
        key: subjectId,
        value: valueFor(subjectId),
        revision: 0,
        activeNode: { key: subjectId, subjectId },
      });
    }
    const randomOffsets = pseudoRandomIds(LATENCY_OPERATIONS, latencyN);
    const accessIds = population === 'dense'
      ? randomOffsets
      : randomOffsets.map((offset) => retainedIds[offset - 1]);

    latencyCases.push({
      variant,
      population,
      storage,
      accessIds,
      samples: { lookup: [], update: [], iteration: [] },
    });
  }
}

const updatedValue = { id: 0, name: 'updated', value: 1 };
for (let sample = -3; sample < LATENCY_SAMPLES; sample++) {
  const offset = ((sample % latencyCases.length) + latencyCases.length) % latencyCases.length;
  const ordered = [
    ...latencyCases.slice(offset),
    ...latencyCases.slice(0, offset),
  ];
  for (const latencyCase of ordered) {
    const { storage, accessIds, samples } = latencyCase;
      let started = process.hrtime.bigint();
      for (const subjectId of accessIds) sink += storage.readChecksum(subjectId);
      const lookup = Number(process.hrtime.bigint() - started) / LATENCY_OPERATIONS;

      started = process.hrtime.bigint();
      for (let index = 0; index < accessIds.length; index++) {
        const subjectId = accessIds[index];
        storage.update(subjectId, updatedValue, index);
      }
      const update = Number(process.hrtime.bigint() - started) / LATENCY_OPERATIONS;

      started = process.hrtime.bigint();
      sink += storage.iterateChecksum();
      const iteration = Number(process.hrtime.bigint() - started) / latencyN;

      if (sample >= 0) {
        samples.lookup.push(lookup);
        samples.update.push(update);
        samples.iteration.push(iteration);
      }
  }
}
const latencyRows = latencyCases.map(({ variant, population, samples }) => ({
  variant,
  population,
  lookupNs: median(samples.lookup),
  updateNs: median(samples.update),
  iterationNsPerSubject: median(samples.iteration),
}));

const byMemory = new Map(memoryRows.map((row) => [`${row.variant}:${row.scenario}`, row]));
const mapDense = byMemory.get('map:dense').bytesPerRetainedSubject;
const problems = [];
if (mapDense < E2_COMPACT_SLOPE * 0.9 || mapDense > E2_COMPACT_SLOPE * 1.1) {
  problems.push(`Map control ${mapDense.toFixed(1)} B/entity does not reproduce E2 ${E2_COMPACT_SLOPE}`);
}
for (const row of memoryRows) {
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.variant}:${row.scenario}@${point.n} did not collect`);
  }
}
for (const variant of ['sparse', 'packed']) {
  const clustered = byMemory.get(`${variant}:sparse-clustered`).points.at(-1);
  const expectedSegments = new Set(
    clusteredHighIds(clustered.n).map(segmentIndex)
  ).size;
  if (clustered.segments !== expectedSegments) {
    problems.push(`${variant} did not reclaim empty clustered segments`);
  }
}
if (problems.length > 0) throw new Error(`E3 prototype failed:\n${problems.join('\n')}`);

const denseSavings = Object.fromEntries(
  ['chunked', 'sparse', 'packed'].map((variant) => [
    variant,
    mapDense - byMemory.get(`${variant}:dense`).bytesPerRetainedSubject,
  ])
);
const randomChurnIncrements = Object.fromEntries(
  Object.keys(VARIANTS).map((variant) => [
    variant,
    byMemory.get(`${variant}:sparse-random`).bytesPerRetainedSubject -
      byMemory.get(`${variant}:sparse-random-direct`).bytesPerRetainedSubject,
  ])
);
const repeatedHighWaterDeltas = Object.fromEntries(
  Object.keys(VARIANTS).map((variant) => [
    variant,
    byMemory.get(`${variant}:repeated-high-water`).bytesPerRetainedSubject -
      byMemory.get(`${variant}:dense`).bytesPerRetainedSubject,
  ])
);

const output = {
  segmentSize: SEGMENT_SIZE,
  memorySizes: MEMORY_SIZES,
  memorySamples: MEMORY_SAMPLES,
  latencySamples: LATENCY_SAMPLES,
  latencyOperations: LATENCY_OPERATIONS,
  memoryRows,
  latencyRows,
  denseSavings,
  randomChurnIncrements,
  repeatedHighWaterDeltas,
  sink,
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nENTITY-PHYSICAL-DENSITY-0 / E3');
console.log(`segment size ${SEGMENT_SIZE}; ${MEMORY_SAMPLES} isolated memory samples; ${LATENCY_SAMPLES} latency samples\n`);
console.log('variant'.padEnd(10) + 'scenario'.padEnd(28) + 'B/subject'.padStart(11) + 'fixed'.padStart(10) + '100k heap'.padStart(13) + 'segments'.padStart(11));
console.log('-'.repeat(83));
for (const row of memoryRows) {
  const last = row.points.at(-1);
  console.log(
    row.variant.padEnd(10) +
      row.scenario.padEnd(28) +
      row.bytesPerRetainedSubject.toFixed(1).padStart(10) +
      `${Math.round(row.fittedFixedBytes / 1024)} KB`.padStart(10) +
      mb(last.retainedBytes).padStart(13) +
      String(last.segments).padStart(11)
  );
}
console.log('\nDense savings versus compact Map');
for (const [variant, bytes] of Object.entries(denseSavings)) {
  console.log(`  ${variant.padEnd(10)} ${bytes.toFixed(1).padStart(7)} B/live subject`);
}
console.log('\nRandom-retirement increment over direct sparse construction');
for (const [variant, bytes] of Object.entries(randomChurnIncrements)) {
  console.log(`  ${variant.padEnd(10)} ${bytes.toFixed(1).padStart(7)} B/retained subject`);
}
console.log('\nRepeated-high-water delta versus dense construction');
for (const [variant, bytes] of Object.entries(repeatedHighWaterDeltas)) {
  console.log(`  ${variant.padEnd(10)} ${bytes.toFixed(1).padStart(7)} B/retained subject`);
}
console.log('\nLatency at 100k retained subjects');
for (const row of latencyRows) {
  console.log(
    `  ${row.variant.padEnd(10)} ${row.population.padEnd(13)} lookup ${row.lookupNs.toFixed(1).padStart(7)} ns  ` +
      `update ${row.updateNs.toFixed(1).padStart(7)} ns  iteration ${row.iterationNsPerSubject.toFixed(1).padStart(7)} ns/subject`
  );
}
console.log(
  '\nSubjectIds remain monotonic and are never reused; sparse/packed variants reclaim empty segments.\n' +
    'This external prototype authorizes no production representation change.'
);
