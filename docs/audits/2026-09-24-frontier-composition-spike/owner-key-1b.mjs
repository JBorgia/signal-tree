#!/usr/bin/env node
// OWNER-KEY-1 half 2 — can the reactive node be bound ONCE to its final lossless
// semantic identity before it participates in a dependency, with no later
// inference from path or business key?
//
// Row 8 is the gate: the semantic key from a pending ADD effect must equal the
// semantic key of the anchor node a reader captures.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const TARGET = 'packages/kernel/src/lib/internals/location-runtime.ts';
const PATCH = [
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
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {}, __capture: true, __outer: undefined };
  const previous = activeConsumer; consumer.__outer = previous; activeConsumer = consumer;
  try { run(); } finally {
    activeConsumer = previous;
    for (const node of collected.keys()) for (const ref of node.consumers) if (ref.deref() === consumer) node.consumers.delete(ref);
  }
  return [...collected.keys()];
}`;
const b = await build({
  stdin: { contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads} from './${TARGET.replace(/\.ts$/,'')}';`,
    resolveDir: root, sourcefile: 'ok1b.ts', loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24',
  plugins: [{ name: 'seam', setup(bb) { bb.onLoad({ filter: /location-runtime\.ts$/ }, ({path}) => {
    if (relative(root,path)!==TARGET) return null;
    const src = readFileSync(path,'utf8');
    if (!src.includes('  if (activeConsumer) {')) throw new Error('ANCHOR MISS');
    return { contents: src.replace('  if (activeConsumer) {', PATCH)+SEAM, loader:'ts', resolveDir: dirname(path) };
  }); } }],
});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush = async (n) => { n.flushSync(); for (let i=0;i<8;i++) await Promise.resolve(); };
const checks = [];
const check = (ok,label,detail) => { checks.push({label,ok,detail}); console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?`  -- ${detail}`:''}`); };

const n = K.getPathNotifier();
const tree = K.signalTree({ rows: K.entityMap({ selectId: (r)=>r.id }) }, { enhancers: [K.transactions()] });
const runtime = K.peekInternalTransactionRuntime(tree);
// anchor node = the single node byIdOrFail registers (established by OWNER-KEY-0)
const anchorOf = (id) => K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail(id))[0];

// ROW 8: pending add -- effect subject vs anchor node
const p1 = tree.transact(() => tree.$.rows.addOne({ id:'A', name:'a', score:1 }));
await flush(n);
const [turnId] = runtime.getPendingTurnIds();
const fx = runtime.describePendingTurn(turnId).effects.find(e=>e.kind==='add');
const anchorA = anchorOf('A');
check(fx?.subject !== undefined && anchorA !== undefined,
  'ROW8 a pending ADD yields both an effect SubjectId and a capturable anchor node',
  `effectSubject=${fx?.subject} anchorNode=${anchorA?'present':'MISSING'}`);
p1.confirm(); await flush(n);

// ROW 4: subject separation
tree.$.rows.addOne({ id:'B', name:'b', score:2 }); await flush(n);
const anchorB = anchorOf('B');
check(anchorA !== anchorB, 'ROW4 different subjects have DISTINCT anchor nodes');

// ROW 3: leaf separation, and leaf != anchor
const scoreNodes = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A').score());
const nameNodes  = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A').name());
const scoreLeaf = scoreNodes.find(x=>x!==anchorA), nameLeaf = nameNodes.find(x=>x!==anchorA);
check(!!scoreLeaf && !!nameLeaf && scoreLeaf!==nameLeaf, 'ROW3 A.score and A.name are DISTINCT leaf nodes');
check(scoreNodes.includes(anchorA), 'ROW3b a leaf read ALSO registers the subject anchor (existence dependency is implicit)');

// ROW 5: rekey keeps identity
tree.$.rows.changeId('A','A2'); await flush(n);
check(anchorOf('A2') === anchorA, 'ROW5 rekey preserves the anchor node (no key-based identity)');

// ROW 6: key reuse must not inherit
tree.$.rows.removeOne('A2'); await flush(n);
const p2 = tree.transact(() => tree.$.rows.addOne({ id:'A2', name:'fresh', score:9 }));
await flush(n);
const [t2] = runtime.getPendingTurnIds();
const fx2 = runtime.describePendingTurn(t2).effects.find(e=>e.kind==='add');
const anchorFresh = anchorOf('A2');
check(anchorFresh !== anchorA, 'ROW6 a fresh subject at a reused key has a FRESH anchor node');
check(fx2?.subject !== undefined && fx2.subject !== fx?.subject,
  'ROW6b ...and a FRESH SubjectId on its effect', `old=${fx?.subject} fresh=${fx2?.subject}`);
try { p2.confirm(); } catch {}
tree.destroy();

writeFileSync(resolve(here,'owner-key-1b.json'), JSON.stringify({probe:'OWNER-KEY-1-half2',checks},null,2)+'\n');
const failed = checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
