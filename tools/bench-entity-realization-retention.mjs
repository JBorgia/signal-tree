#!/usr/bin/env node
/**
 * ENTITY-REALIZATION-RETENTION-0 / E4: production realization ownership.
 *
 * This benchmark changes no production representation. It measures public
 * EntityMap realization arms in isolated processes and uses forced GC plus the
 * existing internal inventory to distinguish weak facades from strongly
 * interned entity cells and activation tokens.
 *
 * Usage:
 *   node --expose-gc tools/bench-entity-realization-retention.mjs
 *   node --expose-gc tools/bench-entity-realization-retention.mjs --samples 1
 *   node --expose-gc tools/bench-entity-realization-retention.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  measureRetained,
  quiesce,
  requireExposeGc,
} from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-entity-realization-retention.mjs');

const DIST = join(process.cwd(), 'dist/packages/kernel/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const { entityMap, signalTree } = await import(`${DIST}/index.js`);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const SIZES = [0, 1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const SAMPLE_IDS = 32;

const seed = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index,
    name: `n${index}`,
    value: index,
  }));

const createTree = (count) => {
  const tree = signalTree({
    rows: entityMap({ selectId: (row) => row.id }),
  });
  tree.$.rows.setAll(seed(count));
  return tree;
};

const internalRows = (tree) => tree.$.rows;
const subjectIdFor = (rows, id) =>
  rows.__acquireEntityHandleForTesting(id)?.subjectId;
const inventoryFor = (rows, id) => {
  const subjectId = subjectIdFor(rows, id);
  return subjectId === undefined
    ? undefined
    : rows.__inspectSubjectResources(subjectId);
};
const sampledIds = (count) => {
  if (count === 0) return [];
  const sampleCount = Math.min(count, SAMPLE_IDS);
  return Array.from(
    { length: sampleCount },
    (_, index) => Math.floor((index * count) / sampleCount)
  );
};

const createReleasedFacades = (rows, count, read) => {
  const refs = [];
  for (let id = 0; id < count; id++) {
    const node = rows.byId(id);
    if (node === undefined) throw new Error(`missing facade ${String(id)}`);
    read(node, id);
    refs.push(new WeakRef(node));
  }
  return refs;
};

const settleReleasedFacades = async (rows, refs, label) => {
  await quiesce({ label });
  const retained = refs.filter((ref) => ref.deref() !== undefined);
  if (retained.length > 0) {
    throw new Error(
      `${label}: ${retained.length}/${refs.length} released facades remain live`
    );
  }
  for (const id of sampledIds(refs.length)) {
    if (inventoryFor(rows, id)?.nodeFacadeMaterialized) {
      throw new Error(`${label}: dead facade remains materialized for ${String(id)}`);
    }
  }
};

const assertInventory = (rows, count, expected, label) => {
  for (const id of sampledIds(count)) {
    const inventory = inventoryFor(rows, id);
    if (inventory === undefined) throw new Error(`${label}: missing inventory ${String(id)}`);
    for (const [key, value] of Object.entries(expected)) {
      if (inventory[key] !== value) {
        throw new Error(
          `${label}: ${key} for ${String(id)} was ${String(inventory[key])}, expected ${String(value)}`
        );
      }
    }
  }
};

const readNothing = () => {};
const readNode = (node, id) => {
  if (node()?.id !== id) throw new Error(`node read lost truth for ${String(id)}`);
};
const readFields = (node, id) => {
  if (node.id() !== id || node.name() !== `n${id}` || node.value() !== id) {
    throw new Error(`field read lost truth for ${String(id)}`);
  }
};

const assertHeldSemanticsAcrossGc = async () => {
  const tree = createTree(3);
  const rows = internalRows(tree);
  const held = rows.byId(1);
  const duplicate = rows.byId(1);
  if (held === undefined || held !== duplicate || held.value() !== 1) {
    throw new Error('simultaneous consumers did not share one live facade');
  }

  await quiesce({ label: 'held-facade-control' });
  rows.updateOne(1, { value: 10 });
  if (held.value() !== 10) {
    throw new Error('held facade stopped receiving updates across forced GC');
  }

  const oldHandle = rows.__acquireEntityHandleForTesting(1);
  rows.removeOne(1);
  rows.addOne({ id: 1, name: 'fresh', value: 20 });
  const freshHandle = rows.__acquireEntityHandleForTesting(1);
  const fresh = rows.byId(1);
  if (
    held() !== undefined ||
    fresh?.value() !== 20 ||
    oldHandle?.subjectId === freshHandle?.subjectId ||
    fresh === held
  ) {
    throw new Error('fresh same-key occupant inherited retired realization identity');
  }
  tree.destroy();
  await quiesce({ label: 'held-facade-control-cleanup' });
};

const ARMS = {
  untouched: {
    ownership: 'canonical EntityMap only; no per-subject realization',
    build: async (count) => {
      const tree = createTree(count);
      assertInventory(internalRows(tree), count, {
        entitySignal: false,
        activationToken: false,
        nodeFacadeMaterialized: false,
      }, 'untouched');
      return tree;
    },
  },
  'released-byid': {
    ownership: 'strong entity cells after weak facades collect',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const refs = createReleasedFacades(rows, count, readNothing);
      await settleReleasedFacades(rows, refs, 'released-byid');
      assertInventory(rows, count, {
        entitySignal: true,
        activationToken: false,
        nodeFacadeMaterialized: false,
      }, 'released-byid');
      return tree;
    },
  },
  'released-node-read': {
    ownership: 'strong entity cells + activation tokens after facades collect',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const refs = createReleasedFacades(rows, count, readNode);
      await settleReleasedFacades(rows, refs, 'released-node-read');
      assertInventory(rows, count, {
        entitySignal: true,
        activationToken: true,
        nodeFacadeMaterialized: false,
      }, 'released-node-read');
      return tree;
    },
  },
  'released-field-read': {
    ownership: 'released node + field derived graph; only strong cells survive',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const refs = createReleasedFacades(rows, count, readFields);
      await settleReleasedFacades(rows, refs, 'released-field-read');
      assertInventory(rows, count, {
        entitySignal: true,
        activationToken: true,
        nodeFacadeMaterialized: false,
      }, 'released-field-read');
      return tree;
    },
  },
  'held-nodes': {
    ownership: 'held facade + all field derived cells/closures/metadata',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const nodes = [];
      for (let id = 0; id < count; id++) {
        const first = rows.byId(id);
        const second = rows.byId(id);
        if (first === undefined || first !== second) {
          throw new Error(`simultaneous consumers duplicated facade ${String(id)}`);
        }
        nodes.push(first);
      }
      assertInventory(rows, count, {
        entitySignal: true,
        activationToken: false,
        nodeFacadeMaterialized: true,
      }, 'held-nodes');
      return { tree, nodes };
    },
  },
  'held-field-reads': {
    ownership: 'held and actively read facade/field derived graph',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const nodes = [];
      for (let id = 0; id < count; id++) {
        const node = rows.byId(id);
        if (node === undefined) throw new Error(`missing held facade ${String(id)}`);
        readFields(node, id);
        nodes.push(node);
      }
      assertInventory(rows, count, {
        entitySignal: true,
        activationToken: true,
        nodeFacadeMaterialized: true,
      }, 'held-field-reads');
      return { tree, nodes };
    },
  },
  reacquired: {
    ownership: 'released facades rebuilt over durable strong cells',
    build: async (count) => {
      const tree = createTree(count);
      const rows = internalRows(tree);
      const refs = createReleasedFacades(rows, count, readFields);
      await settleReleasedFacades(rows, refs, 'reacquired-first-release');
      for (let id = 0; id < count; id++) {
        rows.updateOne(id, { value: id + 1 });
      }
      const secondRefs = createReleasedFacades(rows, count, (node, id) => {
        if (node.value() !== id + 1) {
          throw new Error(`reacquired facade read stale truth for ${String(id)}`);
        }
      });
      await settleReleasedFacades(rows, secondRefs, 'reacquired-second-release');
      return tree;
    },
  },
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  const name = process.argv[armIndex + 1];
  const arm = ARMS[name];
  if (arm === undefined) throw new Error(`unknown arm: ${name}`);
  await assertHeldSemanticsAcrossGc();
  const result = await measureRetained(() => arm.build(size), { label: name });
  console.log(JSON.stringify({
    arm: name,
    n: size,
    ownership: arm.ownership,
    retainedBytes: result.retainedBytes,
    collectable: result.collectable,
    quiesceRounds: result.quiesceRounds,
  }));
  process.exit(0);
}

const measureOnce = (name, n) => {
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
      timeout: 180_000,
    }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
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
  const bytesPerEntity = numerator / denominator;
  const fittedFixedBytes = meanBytes - bytesPerEntity * meanN;
  const residuals = used.map(
    (point) => point.retainedBytes -
      (fittedFixedBytes + bytesPerEntity * point.n)
  );
  const totalVariation = used.reduce(
    (sum, point) => sum + (point.retainedBytes - meanBytes) ** 2,
    0
  );
  const residualVariation = residuals.reduce(
    (sum, residual) => sum + residual ** 2,
    0
  );
  return {
    bytesPerEntity,
    fittedFixedBytes,
    rSquared: totalVariation === 0 ? 1 : 1 - residualVariation / totalVariation,
    maxResidualBytes: Math.max(...residuals.map(Math.abs)),
  };
};

const rows = Object.entries(ARMS).map(([name, arm]) => {
  const points = SIZES.map((n) => measurePoint(name, n));
  return { arm: name, ownership: arm.ownership, points, ...linearFit(points) };
});
const byName = new Map(rows.map((row) => [row.arm, row]));
const untouched = byName.get('untouched').bytesPerEntity;
const releasedById = byName.get('released-byid').bytesPerEntity;
const releasedNode = byName.get('released-node-read').bytesPerEntity;
const releasedField = byName.get('released-field-read').bytesPerEntity;
const heldNodes = byName.get('held-nodes').bytesPerEntity;
const heldFields = byName.get('held-field-reads').bytesPerEntity;
const reacquired = byName.get('reacquired').bytesPerEntity;

const derived = {
  releasedByIdResidual: releasedById - untouched,
  activationTokenIncrement: releasedNode - releasedById,
  releasedFieldGraphIncrement: releasedField - releasedNode,
  heldFacadeGraphIncrement: heldNodes - releasedById,
  heldReadBeyondActivation:
    heldFields - heldNodes - (releasedNode - releasedById),
  reacquisitionIncrement: reacquired - releasedField,
};
const problems = [];
for (const row of rows) {
  if (row.rSquared < 0.995) {
    problems.push(`${row.arm} fit R² ${row.rSquared.toFixed(4)} is below 0.995`);
  }
  for (const point of row.points) {
    if (!point.collectable) problems.push(`${row.arm}@${point.n} did not collect`);
  }
}
if (Math.abs(derived.releasedFieldGraphIncrement) > 20) {
  problems.push(
    `released field graph retained ${derived.releasedFieldGraphIncrement.toFixed(1)} B/entity beyond strong cells`
  );
}
if (Math.abs(derived.reacquisitionIncrement) > 20) {
  problems.push(
    `reacquisition retained ${derived.reacquisitionIncrement.toFixed(1)} B/entity beyond first release`
  );
}
if (problems.length > 0) {
  throw new Error(`E4 attribution failed:\n${problems.join('\n')}`);
}

const output = {
  sizes: SIZES,
  samples: SAMPLES,
  rows,
  derived,
};
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
console.log('\nENTITY-REALIZATION-RETENTION-0 / E4');
console.log(`${SAMPLES} isolated samples per arm and size; production public EntityMap\n`);
console.log(
  'arm'.padEnd(25) +
    SIZES.map((n) => String(n).padStart(11)).join('') +
    '   B/entity'
);
console.log('-'.repeat(82));
for (const row of rows) {
  console.log(
    row.arm.padEnd(25) +
      row.points.map((point) => mb(point.retainedBytes).padStart(11)).join('') +
      row.bytesPerEntity.toFixed(1).padStart(11)
  );
  console.log(`  ${row.ownership}`);
}
console.log('\nExclusive realization deltas');
for (const [name, bytes] of Object.entries(derived)) {
  console.log(`  ${name.padEnd(29)} ${bytes.toFixed(1).padStart(8)} B/entity`);
}
console.log(
  '\nEvery released facade WeakRef clears while the tree remains live; sampled inventory proves which strong cells survive.\n' +
    'Each returned tree owner becomes collectible after release. This evidence authorizes no production retention change.'
);
