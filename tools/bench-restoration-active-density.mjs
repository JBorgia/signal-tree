#!/usr/bin/env node
/**
 * RESTORATION-ACTIVE-DENSITY-0 / A0: locate one-turn O(N) retention.
 *
 * Measures one production one-entity field turn over 1k/10k/100k subjects,
 * then extracts the actual retained HistoryEntry after destroying its tree.
 * Matched artifact arms retain the full entry, its state only, or the same entry
 * without state, so the collection-width owner is subtracted directly.
 *
 * Usage:
 *   node --expose-gc tools/bench-restoration-active-density.mjs
 *   node --expose-gc tools/bench-restoration-active-density.mjs --samples 1
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { quiesce, requireExposeGc } from './lib/heap-quiescence.mjs';

requireExposeGc('tools/bench-restoration-active-density.mjs');

const DIST = join(process.cwd(), 'dist/packages/kernel/dist');
if (!existsSync(join(DIST, 'index.js'))) {
  console.error('build first: pnpm nx build kernel');
  process.exit(1);
}

const { entityMap, restoration, signalTree, undoable } = await import(
  `${DIST}/index.js`
);
const [
  { getSubjectRestorationClaims },
  { getTreeRealizationDescriptors },
] = await Promise.all([
  import(`${DIST}/lib/internals/subject-restoration-claims.js`),
  import(`${DIST}/lib/internals/causal-runtime/tree-realization-adapter.js`),
]);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const SIZES = [1_000, 10_000, 100_000];
const SAMPLES = Number(argument('--samples', 3));
const size = Number(argument('--n', 10_000));
const OPERATION = argument('--operation', 'field');

const applyOperation = (tree, count) => {
  const id = Math.floor(count / 2);
  switch (OPERATION) {
    case 'field':
      tree.$.rows.updateOne(id, { value: -1 });
      return;
    case 'replace':
      tree.$.rows.replaceOne(id, { id, name: 'replaced', value: -1 });
      return;
    case 'add':
      tree.$.rows.addOne({ id: count, name: 'added', value: -1 });
      return;
    case 'remove':
      tree.$.rows.removeOne(id);
      return;
    case 'rekey':
      tree.$.rows.changeId(id, count);
      return;
    case 'prepend':
      tree.$.rows.prependOne({ id: count, name: 'prepended', value: -1 });
      return;
    default:
      throw new Error(`unknown operation: ${OPERATION}`);
  }
};

const seed = (count) =>
  Array.from({ length: count }, (_, id) => ({ id, name: `n${id}`, value: id }));

const createOneTurn = async (count, capacity) => {
  const tree = signalTree(
    {
      counter: 0,
      rows: entityMap({ selectId: (row) => row.id }),
    },
    {
      enhancers: [restoration({ maxHistorySize: capacity })],
      capabilities: ['causal-runtime'],
    }
  );
  tree.$.rows.setAll(seed(count));
  await quiesce({ label: 'active-density-seed' });
  const subjectId = Math.floor(count / 2);
  undoable(() => applyOperation(tree, count));
  await Promise.resolve();
  await Promise.resolve();
  await quiesce({ label: 'active-density-turn' });
  if (capacity > 0) {
    const entry = tree.getRestorationHistory()[0];
    if (entry === undefined) throw new Error('expected exactly one retained turn');
    inspectEntry(entry, tree, subjectId, count);
  }
  return tree;
};

const inspectEntry = (entry, tree, subjectId, count) => {
  const current = tree.$();
  const rows = entry.state.rows.all;
  const expectedLength =
    OPERATION === 'add' || OPERATION === 'prepend'
      ? count + 1
      : OPERATION === 'remove'
        ? count - 1
        : count;
  // Every one-subject op retains one claim, rekey included since
  // RESTORATION-REKEY-CLAIM-WIDTH-0 narrowed the producer participation latch.
  const expectedClaimedSubjects = 1;
  const expectedEffects = OPERATION === 'replace' ? 2 : 1;
  if (
    rows.length !== expectedLength ||
    entry.__effects?.length !== expectedEffects ||
    entry.restorationSubjectIds?.length !== expectedClaimedSubjects ||
    entry.__positionIds?.length !== 1
  ) {
    throw new Error(
      `one-turn cardinality mismatch: expected effects=${expectedEffects}, claims=${expectedClaimedSubjects}, positions=1, rows=${expectedLength}`
    );
  }
  if (
    entry.state.rows !== current.rows ||
    rows !== current.rows.all
  ) {
    throw new Error('history state is not the current canonical collection snapshot');
  }
};

const createOneTurnWithoutState = async (count) => {
  const tree = await createOneTurn(count, 1);
  const manager = tree.__restoration;
  const internalEntry = manager.getTurns()[0];
  if (internalEntry === undefined) {
    throw new Error('could not locate the retained production state owner');
  }
  internalEntry.state = undefined;
  return tree;
};

const createMaterializedZeroHistory = async (count) => {
  const tree = await createOneTurn(count, 0);
  tree.$();
  return tree;
};

const ARMS = {
  'capacity-zero-tree': {
    owner: 'production tree after same turn with zero retained history',
    destroy: true,
    build: (count) => createOneTurn(count, 0),
  },
  'capacity-one-tree': {
    owner: 'production tree plus exactly one retained one-entity turn',
    destroy: true,
    build: (count) => createOneTurn(count, 1),
  },
  'capacity-zero-materialized': {
    owner: 'zero-history tree after one explicit canonical root materialization',
    destroy: true,
    build: createMaterializedZeroHistory,
  },
  'capacity-one-without-state': {
    owner: 'same production one-turn graph with retained entry.state removed',
    destroy: true,
    build: createOneTurnWithoutState,
  },
};

const measureTreeRetained = async (build, label) => {
  const start = await quiesce({ label: `${label} (baseline)` });
  let tree = await build();
  const settled = await quiesce({ label: `${label} (held)` });
  const entry = tree.getRestorationHistory()[0];
  const inventory = {
    historyEntries: tree.getRestorationHistory().length,
    effects: entry?.__effects?.length ?? 0,
    claimedSubjects: entry?.restorationSubjectIds?.length ?? 0,
    positions: entry?.__positionIds?.length ?? 0,
    stateRows: entry?.state?.rows?.all?.length ?? 0,
  };
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
    supportingOwnersCollectable:
      (claimsRef === undefined || claimsRef.deref() === undefined) &&
      (descriptorsRef === undefined || descriptorsRef.deref() === undefined),
    ...inventory,
  };
};

const measureArm = async (name, count) => {
  const arm = ARMS[name];
  const result = await measureTreeRetained(() => arm.build(count), name);
  return {
    ...result,
    arm: name,
    n: count,
    owner: arm.owner,
  };
};

const armIndex = process.argv.indexOf('--arm');
if (armIndex !== -1) {
  console.log(JSON.stringify(await measureArm(process.argv[armIndex + 1], size)));
  process.exit(0);
}

const measureOnce = (name, count) => {
  const output = execFileSync(
    process.execPath,
    [
      '--expose-gc',
      new URL(import.meta.url).pathname,
      '--arm',
      name,
      '--n',
      String(count),
      '--operation',
      OPERATION,
    ],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 240_000 }
  );
  return JSON.parse(output.trim().split('\n').at(-1));
};

const rows = Object.entries(ARMS).map(([name, arm]) => ({
  arm: name,
  owner: arm.owner,
  points: SIZES.map((n) => {
    const samples = Array.from({ length: SAMPLES }, () => measureOnce(name, n));
    return samples.sort((left, right) => left.retainedBytes - right.retainedBytes)[
      Math.floor(samples.length / 2)
    ];
  }),
}));
const byName = new Map(rows.map((row) => [row.arm, row]));
const deltaAt = (left, right, index) =>
  byName.get(left).points[index].retainedBytes -
  byName.get(right).points[index].retainedBytes;
const derived = SIZES.map((n, index) => ({
  n,
  productionOneTurnIncrement: deltaAt('capacity-one-tree', 'capacity-zero-tree', index),
  canonicalMaterializationIncrement:
    deltaAt('capacity-zero-materialized', 'capacity-zero-tree', index),
  oneTurnBeyondMaterialization:
    deltaAt('capacity-one-tree', 'capacity-zero-materialized', index),
  clearingEntryStateIncrement:
    deltaAt('capacity-one-without-state', 'capacity-zero-tree', index),
}));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sizes: SIZES, samples: SAMPLES, rows, derived }, null, 2));
  process.exit(0);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log('\nRESTORATION-ACTIVE-DENSITY-0 / A0');
console.log(`${SAMPLES} isolated samples per arm and size; operation=${OPERATION}; exactly one turn\n`);
console.log('owner'.padEnd(31) + SIZES.map((n) => String(n).padStart(13)).join(''));
console.log('-'.repeat(70));
for (const row of rows) {
  console.log(
    row.arm.padEnd(31) +
      row.points.map((point) => kb(point.retainedBytes).padStart(13)).join('')
  );
}
console.log('\nDirect attribution');
for (const point of derived) {
  console.log(
    `  ${String(point.n).padStart(6)} subjects  production +turn ${kb(point.productionOneTurnIncrement).padStart(10)}  ` +
      `materialization ${kb(point.canonicalMaterializationIncrement).padStart(10)}  ` +
      `turn beyond materialization ${kb(point.oneTurnBeyondMaterialization).padStart(10)}  ` +
      `state-cleared tree ${kb(point.clearingEntryStateIncrement).padStart(10)}`
  );
}
console.log(
  `\n100k retained-turn inventory: effects=${byName.get('capacity-one-tree').points.at(-1).effects}, ` +
    `claimedSubjects=${byName.get('capacity-one-tree').points.at(-1).claimedSubjects}, ` +
    `positions=${byName.get('capacity-one-tree').points.at(-1).positions}, ` +
    `stateRows=${byName.get('capacity-one-tree').points.at(-1).stateRows}.\n` +
    'The first turn forces canonical materialization; HistoryEntry.state and the live snapshot cache share that N-wide object.\n' +
    (OPERATION === 'rekey'
      ? 'REKEY: one claimed subject and one position, since RESTORATION-REKEY-CLAIM-WIDTH-0 (was the entire stale collection inventory).\n'
      : 'The one-subject operation retains exactly one claimed subject and one position.\n') +
    'A0 attributes current production retention; E5 owns lifecycle collectability.'
);
