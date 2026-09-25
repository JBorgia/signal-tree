#!/usr/bin/env node
// DEPENDENCY-1F — does a captured dependency stay attached to the SUBJECT
// LIFETIME and the specific leaf, or does it collapse to a key/path string?
//
// This is a FALSIFIER, not a happy path. v15 established that subject lifetime
// and business key are different semantic dimensions. If dependency identity
// reintroduces key/path identity, it undoes one of the strongest things the
// kernel already got right, and F3 would be meaningless -- "P2 depends on
// lifetime S1 owned by P1" would degrade to "P2 touched key A".
//
// Verdict is the exit code.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const TARGET = 'packages/kernel/src/lib/internals/location-runtime.ts';

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
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {},
    __capture: true, __outer: undefined };
  const previous = activeConsumer;
  consumer.__outer = previous;
  activeConsumer = consumer;
  try { run(); } finally {
    activeConsumer = previous;
    for (const node of collected.keys())
      for (const ref of node.consumers)
        if (ref.deref() === consumer) node.consumers.delete(ref);
  }
  return [...collected.keys()];
}
`;

const bundled = await build({
  stdin: {
    contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads} from './${TARGET.replace(/\.ts$/, '')}';`,
    resolveDir: root,
    sourcefile: 'dep1f-entry.ts',
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
          return { contents: source.replace(anchor, PATCH_TRACK) + SEAM, loader: 'ts', resolveDir: dirname(path) };
        });
      },
    },
  ],
});
const K = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
);

const problems = [];
const check = (ok, label, detail) => {
  problems.push({ label, ok, ...(detail ? { detail } : {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  -- ${detail}`}`);
};

const make = () => {
  const tree = K.signalTree(
    { rows: K.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [K.transactions()] }
  );
  return tree;
};
const capture = (fn) => K.__spikeCaptureReads(fn);
const one = (fn, label) => {
  const nodes = capture(fn);
  if (nodes.length === 0) throw new Error(`${label}: no read captured at all`);
  return nodes;
};

// ---------------------------------------------------------------- F-a + F-d
{
  const tree = make();
  tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
  const a = tree.$.rows.byIdOrFail('A');
  const score = one(() => a.score(), 'F-a score');
  const name = one(() => a.name(), 'F-d name');
  check(
    !score.some((n) => name.includes(n)),
    'F-d score and name are DISTINCT dependencies',
    `score=${score.length} name=${name.length} shared=${score.filter((n) => name.includes(n)).length}`
  );
  // Reading the same field twice must land on the same node (stable identity).
  const again = one(() => a.score(), 'F-a repeat');
  check(
    score.some((n) => again.includes(n)),
    'F-a the same field yields the SAME dependency node'
  );
  tree.destroy();
}

// ---------------------------------------------------------------------- F-b
// Rekey the subject. The dependency must still name the same lifetime.
{
  const tree = make();
  tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
  const before = one(() => tree.$.rows.byIdOrFail('A').score(), 'F-b before');
  // changeId is the real rekey; updateOne does not move the business key.
  tree.$.rows.changeId('A', 'B');
  let after = [];
  let moved = true;
  try {
    after = one(() => tree.$.rows.byIdOrFail('B').score(), 'F-b after');
  } catch (error) {
    moved = false;
    check(false, 'F-b rekey A->B keeps the subject reachable', String(error.message).slice(0, 80));
  }
  if (moved)
    check(
      before.some((n) => after.includes(n)),
      'F-b dependency SURVIVES rekey (same SubjectId, not the key string)',
      `before=${before.length} after=${after.length} shared=${before.filter((n) => after.includes(n)).length}`
    );
  tree.destroy();
}

// ---------------------------------------------------------------------- F-c
// THE CRITICAL CONTROL. Remove the subject, create a FRESH one at the same key.
// A key-identity model would retarget the old dependency onto the new subject.
{
  const tree = make();
  tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
  const old = one(() => tree.$.rows.byIdOrFail('A').score(), 'F-c old');
  tree.$.rows.removeOne('A');
  tree.$.rows.addOne({ id: 'A', name: 'fresh', score: 99 });
  const fresh = one(() => tree.$.rows.byIdOrFail('A').score(), 'F-c fresh');
  const shared = old.filter((n) => fresh.includes(n));
  check(
    shared.length === 0,
    'F-c dependency does NOT retarget to a fresh subject reusing the key',
    `shared nodes=${shared.length} (must be 0; nonzero means key identity)`
  );
  tree.destroy();
}

// ---------------------------------------------------------------------- F-e
// Path-collision control. A literal key "a.b" must not collide with nested a->b.
{
  const tree = K.signalTree(
    { a: { b: 0 }, rows: K.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [K.transactions()] }
  );
  tree.$.rows.addOne({ id: 'a.b', name: 'literal', score: 7 });
  const nested = one(() => tree.$.a.b(), 'F-e nested');
  const literal = one(() => tree.$.rows.byIdOrFail('a.b').score(), 'F-e literal');
  const shared = nested.filter((n) => literal.includes(n));
  check(
    shared.length === 0,
    'F-e literal key "a.b" does NOT collide with nested a->b',
    `shared nodes=${shared.length} (must be 0)`
  );
  tree.destroy();
}

writeFileSync(resolve(here, 'dependency-1f.json'), JSON.stringify({ probe: 'DEPENDENCY-1F', problems }, null, 2) + '\n');
const failed = problems.filter((p) => !p.ok);
console.log(`\n${problems.length - failed.length}/${problems.length} checks passed`);
process.exit(failed.length ? 1 : 0);
