#!/usr/bin/env node
/**
 * Public entityMap layer decomposition.
 *
 * The kernel benchmark proves logical work for specific operations. The broad
 * cross-library collection benchmark charges a whole task. This splits the
 * public SignalTree path into construction, initial population, existing-member
 * update, structural mutations, projection reads, and retained heap.
 *
 * Usage:
 *   node --expose-gc tools/bench-public-collection-layers.mjs [--n 10000] [--samples 5]
 *   node --expose-gc tools/bench-public-collection-layers.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

if (typeof globalThis.gc !== 'function') {
  console.error('Run with --expose-gc.');
  process.exit(1);
}

const ROOT = process.cwd();
const CORE = join(ROOT, 'dist/packages/core/dist/index.js');
if (!existsSync(CORE)) {
  console.error('build first: nx run-many -t build --all');
  process.exit(1);
}

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const has = (name) => process.argv.includes(name);
const N = Number(arg('--n', 10_000));
const SAMPLES = Number(arg('--samples', 5));
const SCENARIO = arg('--scenario', null);
const JSON_ONLY = has('--json');
const MB = 1024 * 1024;

const rows = (n) =>
  Array.from({ length: n }, (_, index) => ({
    id: index,
    name: `name${index}`,
    value: index,
    active: index % 2 === 0,
  }));

function settle() {
  for (let index = 0; index < 4; index++) globalThis.gc();
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

async function measureOperation({ setup, operation, keep }) {
  const { signalTree, entityMap } = await import(CORE);
  const data = rows(N);
  const context = { signalTree, entityMap, data, n: N };

  const prepared = setup(context);
  settle();
  const beforeHeap = process.memoryUsage().heapUsed;
  const start = performance.now();
  const result = operation({ ...context, ...prepared });
  const durationMs = performance.now() - start;
  const held = keep({ ...context, ...prepared, result });
  settle();
  const afterHeap = process.memoryUsage().heapUsed;
  const ref = new WeakRef(typeof held === 'object' && held !== null ? held : { held });
  return {
    durationMs,
    retainedMB: (afterHeap - beforeHeap) / MB,
    collectableProbeLive: ref.deref() !== undefined,
  };
}

const scenarios = {
  'plain-array-construct': {
    group: 'construction',
    description: 'signalTree({ rows: Row[] }) construction with 10k rows',
    setup: () => ({}),
    operation: ({ signalTree, data }) => signalTree({ rows: data }),
    keep: ({ result }) => result,
  },
  'entitymap-declare': {
    group: 'construction',
    description: 'signalTree({ rows: entityMap() }) declaration without population',
    setup: () => ({}),
    operation: ({ signalTree, entityMap }) => signalTree({ rows: entityMap({ selectId: (row) => row.id }) }),
    keep: ({ result }) => result,
  },
  'entitymap-setAll': {
    group: 'initial-population',
    description: 'entityMap.setAll(10k rows)',
    setup: ({ signalTree, entityMap }) => ({ tree: signalTree({ rows: entityMap({ selectId: (row) => row.id }) }) }),
    operation: ({ tree, data }) => tree.$.rows.setAll(data),
    keep: ({ tree }) => tree,
  },
  'entitymap-addMany': {
    group: 'initial-population',
    description: 'entityMap.addMany(10k rows)',
    setup: ({ signalTree, entityMap }) => ({ tree: signalTree({ rows: entityMap({ selectId: (row) => row.id }) }) }),
    operation: ({ tree, data }) => tree.$.rows.addMany(data),
    keep: ({ tree }) => tree,
  },
  'entitymap-updateOne': {
    group: 'existing-value-update',
    description: 'existing entityMap.updateOne at 10k',
    setup: ({ signalTree, entityMap, data, n }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree, id: Math.floor(n / 2) };
    },
    operation: ({ tree, id }) => tree.$.rows.updateOne(id, { value: 1_000_000 }),
    keep: ({ tree }) => tree,
  },
  'entitymap-updateOne-dependent-read': {
    group: 'existing-value-update',
    description: 'existing updateOne plus byId dependent read at 10k',
    setup: ({ signalTree, entityMap, data, n }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      const id = Math.floor(n / 2);
      const node = tree.$.rows.byIdOrFail(id);
      return { tree, id, node };
    },
    operation: ({ tree, id, node }) => {
      tree.$.rows.updateOne(id, { value: 1_000_000 });
      return node.value();
    },
    keep: ({ tree, node }) => ({ tree, node }),
  },
  'entitymap-addOne': {
    group: 'structural',
    description: 'structural addOne into 10k collection',
    setup: ({ signalTree, entityMap, data, n }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree, entity: { id: n + 1, name: 'new', value: n + 1, active: true } };
    },
    operation: ({ tree, entity }) => tree.$.rows.addOne(entity),
    keep: ({ tree }) => tree,
  },
  'entitymap-removeOne': {
    group: 'structural',
    description: 'structural removeOne from 10k collection',
    setup: ({ signalTree, entityMap, data, n }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree, id: Math.floor(n / 2) };
    },
    operation: ({ tree, id }) => tree.$.rows.removeOne(id),
    keep: ({ tree }) => tree,
  },
  'entitymap-changeId': {
    group: 'structural',
    description: 'structural changeId in 10k collection',
    setup: ({ signalTree, entityMap, data, n }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree, from: Math.floor(n / 2), to: n + 1 };
    },
    operation: ({ tree, from, to }) => tree.$.rows.changeId(from, to),
    keep: ({ tree }) => tree,
  },
  'entitymap-projection-all': {
    group: 'projection-read',
    description: 'read all() from 10k collection',
    setup: ({ signalTree, entityMap, data }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree };
    },
    operation: ({ tree }) => tree.$.rows.all(),
    keep: ({ tree, result }) => ({ tree, result }),
  },
  'entitymap-projection-ids': {
    group: 'projection-read',
    description: 'read ids() from 10k collection',
    setup: ({ signalTree, entityMap, data }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree };
    },
    operation: ({ tree }) => tree.$.rows.ids(),
    keep: ({ tree, result }) => ({ tree, result }),
  },
  'entitymap-projection-asMap': {
    group: 'projection-read',
    description: 'read asMap() from 10k collection',
    setup: ({ signalTree, entityMap, data }) => {
      const tree = signalTree({ rows: entityMap({ selectId: (row) => row.id }) });
      tree.$.rows.setAll(data);
      return { tree };
    },
    operation: ({ tree }) => tree.$.rows.asMap(),
    keep: ({ tree, result }) => ({ tree, result }),
  },
};

async function runScenario(name) {
  const scenario = scenarios[name];
  if (!scenario) {
    console.error(`Unknown scenario: ${name}`);
    process.exit(1);
  }
  const result = await measureOperation(scenario);
  process.stdout.write(JSON.stringify({ name, group: scenario.group, description: scenario.description, ...result }));
}

function runChild(name) {
  const output = execFileSync(
    process.execPath,
    ['--expose-gc', fileURLToPath(import.meta.url), '--scenario', name, '--n', String(N), '--json'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

if (SCENARIO) {
  await runScenario(SCENARIO);
  process.exit(0);
}

const rowsOut = [];
for (const name of Object.keys(scenarios)) {
  const samples = [];
  for (let index = 0; index < SAMPLES; index++) samples.push(runChild(name));
  rowsOut.push({
    name,
    group: scenarios[name].group,
    description: scenarios[name].description,
    durationMs: summarize(samples.map((sample) => sample.durationMs)),
    retainedMB: summarize(samples.map((sample) => sample.retainedMB)),
  });
}

const report = { n: N, samples: SAMPLES, rows: rowsOut };
if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Public entityMap layer decomposition, n=${N}, samples=${SAMPLES}\n`);
  for (const row of rowsOut) {
    console.log(
      `${row.name.padEnd(42)} ${row.durationMs.median.toFixed(3).padStart(9)} ms   ${row.retainedMB.median.toFixed(2).padStart(7)} MB   ${row.group}`
    );
  }
}
