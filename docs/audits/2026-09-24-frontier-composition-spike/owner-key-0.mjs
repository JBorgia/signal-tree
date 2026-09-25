#!/usr/bin/env node
// OWNER-KEY-0 — can frontier ownership and read dependency share ONE stable
// internal identity, removing any reverse resolution through address or
// PositionId?
//
//   Candidate A   DependencyNode -> PositionId -> pending turn -> owner
//   Candidate B   DependencyNode -> active frontier owner, directly
//
// B is only possible if a WRITE registers the same node a READ of that location
// registers. If it does, frontier ownership is buildable from capture alone and
// Candidate A is an unnecessary translation layer. If it does not, B needs its
// own write-side seam and the two candidates are closer in cost.
//
// Also answers what the TWO nodes captured by `byIdOrFail(A).score()` actually
// are -- if one is a subject-existence anchor, the kernel may already have the
// structural tokenization frontier needs.
//
// No production change. Verdict is the exit code. Run unpiped.
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
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads} from './${TARGET.replace(/\.ts$/, '')}';`,
    resolveDir: root,
    sourcefile: 'ok0-entry.ts',
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

const checks = [];
const check = (ok, label, detail) => {
  checks.push({ label, ok, ...(detail ? { detail } : {}) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  -- ${detail}`}`);
};
const note = (text) => {
  checks.push({ label: `NOTE ${text}`, ok: true });
  console.log(`      ${text}`);
};
const cap = (fn) => K.__spikeCaptureReads(fn);
const flush = async (n) => {
  n.flushSync();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

// ============================ THE PREREQUISITE ============================
// Does a WRITE register the same node a READ registers? Candidate B depends
// entirely on this.
{
  const tree = K.signalTree({ x: 0 }, { enhancers: [K.transactions()] });
  const readNodes = cap(() => tree.$.x());
  const writeNodes = cap(() => tree.$.x(5));
  const shared = writeNodes.filter((n) => readNodes.includes(n));
  check(
    shared.length > 0,
    'PREREQ a WRITE registers the same node a READ does (frontier keyable from capture alone)',
    `read=${readNodes.length} write=${writeNodes.length} shared=${shared.length}`
  );
  note(`write-only nodes = ${writeNodes.filter((n) => !readNodes.includes(n)).length}`);
  tree.destroy();
}

// ====================== F: what ARE the two nodes? ========================
{
  const tree = K.signalTree(
    { rows: K.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [K.transactions()] }
  );
  tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 });
  const lookupOnly = cap(() => tree.$.rows.byIdOrFail('A'));
  const scoreOnly = cap(() => {
    const s = tree.$.rows.byIdOrFail('A');
    return s.score();
  });
  const nameOnly = cap(() => {
    const s = tree.$.rows.byIdOrFail('A');
    return s.name();
  });
  note(`byIdOrFail alone captures ${lookupOnly.length} node(s)`);
  note(`byIdOrFail + .score() captures ${scoreOnly.length} node(s)`);
  const shared = scoreOnly.filter((n) => nameOnly.includes(n));
  check(
    shared.length > 0,
    'F score and name reads SHARE a node (a subject-level anchor exists)',
    `score=${scoreOnly.length} name=${nameOnly.length} shared=${shared.length}`
  );
  check(
    scoreOnly.length > shared.length,
    'F ...and each ALSO has its own leaf node (anchor + leaf, not one blob)',
    `leaf-only nodes for score = ${scoreOnly.length - shared.length}`
  );
  const anchorIsLookup = lookupOnly.length > 0 && shared.some((n) => lookupOnly.includes(n));
  note(`the shared node ${anchorIsLookup ? 'IS' : 'is NOT'} the one byIdOrFail registers`);
  tree.destroy();
}

// ============ A/B/C/D/E: node-keyed frontier, built from capture ==========
{
  const n = K.getPathNotifier();
  const tree = K.signalTree(
    { x: 0, rows: K.entityMap({ selectId: (r) => r.id }) },
    { enhancers: [K.transactions()] }
  );
  // Candidate B, in miniature: ownership keyed directly by DependencyNode.
  const frontier = new Map();
  const owned = new Map();
  const claim = (owner, fn) => {
    const nodes = cap(fn);
    owned.set(owner, nodes);
    for (const node of nodes) frontier.set(node, owner);
    return nodes;
  };
  const resolveOwner = (fn) => {
    const nodes = cap(fn);
    const owners = [...new Set(nodes.map((node) => frontier.get(node)).filter(Boolean))];
    return owners;
  };
  const settle = (owner) => {
    for (const node of owned.get(owner) ?? []) if (frontier.get(node) === owner) frontier.delete(node);
    owned.delete(owner);
  };

  // A scalar
  claim('P1', () => tree.$.x(1));
  check(resolveOwner(() => tree.$.x()).includes('P1'), 'A scalar read resolves to the writing owner');

  // B entity leaf
  claim('P2', () => tree.$.rows.addOne({ id: 'A', name: 'a', score: 1 }));
  await flush(n);
  const ownersOfScore = resolveOwner(() => tree.$.rows.byIdOrFail('A').score());
  check(ownersOfScore.includes('P2'), 'B entity-leaf read resolves to the creating owner',
    `owners=${JSON.stringify(ownersOfScore)}`);

  // C rekey: same subject, ownership must follow
  tree.$.rows.changeId('A', 'B');
  await flush(n);
  const afterRekey = resolveOwner(() => tree.$.rows.byIdOrFail('B').score());
  check(afterRekey.includes('P2'), 'C ownership SURVIVES rekey with no repair step',
    `owners=${JSON.stringify(afterRekey)}`);

  // E leaf separation
  const scoreNodes = cap(() => tree.$.rows.byIdOrFail('B').score());
  const nameNodes = cap(() => tree.$.rows.byIdOrFail('B').name());
  check(
    scoreNodes.some((x) => !nameNodes.includes(x)),
    'E score and name remain distinguishable frontier entries'
  );

  // D key reuse: a fresh subject at a freed key must NOT inherit ownership
  tree.$.rows.removeOne('B');
  tree.$.rows.addOne({ id: 'B', name: 'fresh', score: 99 });
  await flush(n);
  const freshOwners = resolveOwner(() => tree.$.rows.byIdOrFail('B').score());
  check(!freshOwners.includes('P2'),
    'D a fresh subject reusing the key does NOT inherit the old owner',
    `owners=${JSON.stringify(freshOwners)}`);

  // G cleanup
  settle('P1');
  settle('P2');
  check(frontier.size === 0, 'G settling every owner leaves NO ownership state behind',
    `remaining entries=${frontier.size}`);
  tree.destroy();
}

writeFileSync(resolve(here, 'owner-key-0.json'), JSON.stringify({ probe: 'OWNER-KEY-0', checks }, null, 2) + '\n');
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
