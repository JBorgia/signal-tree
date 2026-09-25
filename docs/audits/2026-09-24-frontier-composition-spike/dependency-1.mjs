#!/usr/bin/env node
// DEPENDENCY-1 — can SignalTree capture reads made during transact() using the
// REAL leaf runtime, with correct identity and acceptable overhead, without
// changing ordinary reactive semantics?
//
// ARCHITECTURE RULE (frozen before implementing): read capture creates
// dependency EVIDENCE; it must not become a second reactive graph. This probe
// obeys it by construction -- it reads off the kernel's EXISTING dependency
// mechanism. `trackDependency()` in location-runtime.ts is already the single
// chokepoint every read passes through, and already records an edge whenever an
// `activeConsumer` is installed. The probe installs a collecting consumer for
// the duration of the callback and reads the node set it accumulated. No new
// graph, no parallel bookkeeping.
//
// Production source is NOT modified. The one needed seam is injected into the
// module IN MEMORY by an esbuild plugin, so feasibility and cost are measured
// against the real runtime while the repo stays clean.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const TARGET = 'packages/kernel/src/lib/internals/location-runtime.ts';

// The entire seam. If DEPENDENCY-1 is adopted, this is the shape of the
// production change: one exported function, no change to trackDependency.
const PATCH_TRACK = [
  `  if (activeConsumer) {`,
  `    if (activeConsumer.__capture) {`,
  `      let e = activeConsumer.dependencies.get(node);`,
  `      if (!e) { const r = new WeakRef(activeConsumer); e = { reference: r, version: node.version };`,
  `        node.consumers.add(r); activeConsumer.dependencies.set(node, e); } else { e.version = node.version; }`,
  `      const outer = activeConsumer; activeConsumer = outer.__outer;`,
  `      try { trackDependency(node, token); } finally { activeConsumer = outer; }`,
  `      return;`,
  `    }`,
].join('\n');

const SEAM = `
export function __spikeCaptureReads(run) {
  const collected = new Map();
  const consumer = {
    dependencies: collected,
    level: 0,
    invalidate() {},
    settle() {},
    // Capture must be ADDITIVE. trackDependency early-returns whenever an
    // activeConsumer is installed, so a naive capture consumer SUPPRESSES
    // token().observe() for every read in the callback -- interception, not
    // observation. Marked consumers record the edge and then re-enter
    // trackDependency with the outer consumer restored, so the ordinary path
    // still runs.
    __capture: true,
    __outer: undefined,
  };
  const previous = activeConsumer;
  consumer.__outer = previous;
  activeConsumer = consumer;
  try {
    run();
  } finally {
    activeConsumer = previous;
    // Drop the edges this probe created so the real graph is left untouched:
    // evidence collection must not leave a consumer wired into the graph.
    for (const node of collected.keys())
      for (const ref of node.consumers)
        if (ref.deref() === consumer) node.consumers.delete(ref);
  }
  return [...collected.keys()];
}
`;

const bundled = await build({
  stdin: {
    contents: `export {signalTree} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads} from './${TARGET.replace(/\.ts$/, '')}';`,
    resolveDir: root,
    sourcefile: 'dep1-entry.ts',
    loader: 'ts',
  },
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  plugins: [
    {
      name: 'inject-read-capture-seam',
      setup(b) {
        b.onLoad({ filter: /location-runtime\.ts$/ }, ({ path }) => {
          if (relative(root, path) !== TARGET) return null;
          const source = readFileSync(path, 'utf8');
          const anchor = '  if (activeConsumer) {';
          if (!source.includes(anchor)) throw new Error('ANCHOR MISS: trackDependency');
          const patched = source.replace(anchor, PATCH_TRACK);
          return { contents: patched + SEAM, loader: 'ts', resolveDir: dirname(path) };
        });
      },
    },
  ],
});
const K = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

const flush = async (n) => {
  n.flushSync();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// ------------------------------------------------------------------ SEMANTICS
const arm = async (label, buildCallback, expect) => {
  const n = K.getPathNotifier();
  const tree = K.signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [K.transactions()] });
  const row = { label, expect };
  try {
    // Identify nodes by reading each location alone under capture.
    const idOf = {};
    for (const key of ['x', 'y', 'z']) {
      const [node] = K.__spikeCaptureReads(() => tree.$[key]());
      idOf[key] = node;
    }
    const callback = buildCallback(tree); // hoisted reads happen HERE, not below
    let nodes = [];
    const p = tree.transact(() => {
      nodes = K.__spikeCaptureReads(callback);
    });
    await flush(p ? n : n);
    const names = nodes
      .map((node) => Object.keys(idOf).find((k) => idOf[k] === node) ?? '?')
      .filter((name) => name !== 'y'); // y is the write target, not a dependency
    row.observed = [...new Set(names)].sort();
    row.rawCount = nodes.length;
    row.pass = JSON.stringify(row.observed) === JSON.stringify(expect);
    p.confirm();
  } catch (error) {
    row.error = String(error?.message ?? error).slice(0, 140);
    row.pass = false;
  } finally {
    tree.destroy();
  }
  return row;
};

const rows = [];
rows.push(await arm('A literal      y(1)', (t) => () => t.$.y(1), []));
rows.push(await arm('B dependency   y(x())', (t) => () => t.$.y(t.$.x()), ['x']));
rows.push(await arm('C unrelated    y(z())', (t) => () => t.$.y(t.$.z()), ['z']));
rows.push(
  await arm('D hoisted      v=x(); y(v)', (t) => {
    const v = t.$.x();
    return () => t.$.y(v);
  }, [])
);
rows.push(await arm('E repeated     y(x()+x())', (t) => () => t.$.y(t.$.x() + t.$.x()), ['x']));

// ----------------------------------------------------------------------- COST
const bench = (label, run, iterations = 20000) => {
  for (let i = 0; i < 2000; i++) run(i); // warm
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) run(i);
  const ns = Number(process.hrtime.bigint() - start) / iterations;
  return { label, nsPerOp: Math.round(ns * 100) / 100 };
};

const n = K.getPathNotifier();
const tree = K.signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [K.transactions()] });
const cost = [
  bench('point write, no capture', (i) => tree.$.y(i)),
  bench('point write, inside capture', (i) => K.__spikeCaptureReads(() => tree.$.y(i))),
  bench('capture with ZERO reads', () => K.__spikeCaptureReads(() => undefined)),
  bench('capture with ONE read', () => K.__spikeCaptureReads(() => tree.$.x())),
  bench('capture with TEN reads', () => K.__spikeCaptureReads(() => { for (let j = 0; j < 10; j++) tree.$.x(); })),
];
tree.destroy();

const report = { probe: 'DEPENDENCY-1', semantics: rows, cost };
writeFileSync(resolve(here, 'dependency-1.json'), JSON.stringify(report, null, 2) + '\n');
for (const r of rows)
  console.log(
    `${r.label.padEnd(28)} observed=${JSON.stringify(r.observed ?? r.error).padEnd(10)} expect=${JSON.stringify(r.expect).padEnd(7)} ${r.pass ? 'PASS' : 'FAIL'}`
  );
console.log();
for (const c of cost) console.log(`${c.label.padEnd(30)} ${c.nsPerOp} ns/op`);
process.exit(rows.every((r) => r.pass) ? 0 : 1);
