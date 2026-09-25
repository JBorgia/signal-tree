#!/usr/bin/env node
// CANDIDATE C — minimal binding + the two preregistered gates.
//
// GATE 1 (ROW 8 EQUALITY): the semantic identity derived from the TurnEffect
//   must EQUAL the identity BOUND to the captured anchor node. Not "both exist".
// GATE 2 (SCALAR ROW): the scalar node's bound identity must equal the effect's
//   position for that scalar.
//
// The binding uses the KERNEL's own subjectId at the site where the anchor is
// created, never the id the test asked for -- otherwise the test would be
// proving its own bookkeeping.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const LR = 'packages/kernel/src/lib/internals/location-runtime.ts';
const ES = 'packages/kernel/src/lib/entity-signal.ts';
const ST = 'packages/kernel/src/lib/signal-tree.ts';

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

// The whole Candidate C binding surface: three namespaces, nothing generalized.
const SEAM = `
const __spikeIdentity = new WeakMap();
export function __spikeCaptureReads(run) {
  const collected = new Map();
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {}, __capture: true, __outer: undefined };
  const previous = activeConsumer; consumer.__outer = previous; activeConsumer = consumer;
  try { run(); } finally {
    activeConsumer = previous;
    for (const node of collected.keys()) for (const ref of node.consumers) if (ref.deref() === consumer) node.consumers.delete(ref);
  }
  return [...collected.keys()];
}
export function __spikeBind(node, identity) { if (node) __spikeIdentity.set(node, identity); }
export function __spikeIdentityOf(node) { return __spikeIdentity.get(node); }
/** Bind by reading the location once under capture, at its construction site. */
export function __spikeBindLocation(location, identity) {
  try { const [node] = __spikeCaptureReads(() => location()); __spikeBind(node, identity); } catch { /* not yet readable */ }
}
`;

const b = await build({
  stdin: { contents: `export {signalTree, entityMap} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads, __spikeIdentityOf} from './${LR.replace(/\.ts$/,'')}';`,
    resolveDir: root, sourcefile: 'cspike.ts', loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24',
  plugins: [{ name: 'c-binding', setup(bb) {
    bb.onLoad({ filter: /location-runtime\.ts$/ }, ({path}) => {
      if (relative(root,path)!==LR) return null;
      const src = readFileSync(path,'utf8');
      if (!src.includes('  if (activeConsumer) {')) throw new Error('ANCHOR MISS track');
      return { contents: src.replace('  if (activeConsumer) {', PATCH_TRACK)+SEAM, loader:'ts', resolveDir: dirname(path) };
    });
    bb.onLoad({ filter: /entity-signal\.ts$/ }, ({path}) => {
      if (relative(root,path)!==ES) return null;
      let src = readFileSync(path,'utf8');
      const anchor = `      epoch = locations.createEpoch ? locations.createEpoch() : neutralEpoch();
      subjectEpochs.set(subjectId, epoch);`;
      if (!src.includes(anchor)) throw new Error('ANCHOR MISS epoch');
      src = src.replace(anchor, anchor + `
      // CANDIDATE C: bind the anchor node to the kernel's OWN subjectId, here,
      // where it is already in scope. subject-existence namespace.
      __spikeBindLocation(epoch, { kind: 'subject', subject: subjectId });`);
      return { contents: `import { __spikeBindLocation } from './internals/location-runtime';\n` + src, loader:'ts', resolveDir: dirname(path) };
    });
    bb.onLoad({ filter: /signal-tree\.ts$/ }, ({path}) => {
      if (relative(root,path)!==ST) return null;
      let src = readFileSync(path,'utf8');
      const anchor = `  defineNodeAddress(leaf as object, address);`;
      if (!src.includes(anchor)) throw new Error('ANCHOR MISS finalizeLeafSignal');
      src = src.replace(anchor, anchor + `
  // CANDIDATE C: scalar namespace. positionIds stays PLURAL -- collapsing to
  // [0] is the shorthand that hid the entity collision in OWNER-SEAM-2B.
  __spikeBindLocation(leaf as never, { kind: 'scalar', positions: [...(positionIds ?? [])] });`);
      return { contents: `import { __spikeBindLocation } from './internals/location-runtime';\n` + src, loader:'ts', resolveDir: dirname(path) };
    });
  } }],
});
const K = await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush = async (n) => { n.flushSync(); for (let i=0;i<8;i++) await Promise.resolve(); };
const checks = [];
const check = (ok,label,detail) => { checks.push({label,ok,detail}); console.log(`${ok?'PASS':'FAIL'}  ${label}${detail?`  -- ${detail}`:''}`); };

const n = K.getPathNotifier();
const tree = K.signalTree({ x: 0, rows: K.entityMap({ selectId:(r)=>r.id }) }, { enhancers: [K.transactions()] });
const runtime = K.peekInternalTransactionRuntime(tree);

// ---- GATE 1: ROW 8 EQUALITY ----
const p1 = tree.transact(() => tree.$.rows.addOne({ id:'A', name:'a', score:1 }));
await flush(n);
const [t1] = runtime.getPendingTurnIds();
const addFx = runtime.describePendingTurn(t1).effects.find(e=>e.kind==='add');
const anchorNode = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A'))[0];
const bound = K.__spikeIdentityOf(anchorNode);
console.log(`effect: subject=${addFx?.subject}   anchor binding: ${JSON.stringify(bound)}`);
check(!!bound, 'GATE1a the anchor node HAS a bound semantic identity', JSON.stringify(bound));
check(bound?.kind === 'subject' && bound?.subject === addFx?.subject,
  'GATE1 ROW8 EQUALITY: effect SubjectId === anchor node bound SubjectId',
  `effect=${addFx?.subject} bound=${bound?.subject}`);
p1.confirm(); await flush(n);

// non-vacuity: a DIFFERENT subject must not match the first effect
tree.$.rows.addOne({ id:'B', name:'b', score:2 }); await flush(n);
const bNode = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('B'))[0];
const bBound = K.__spikeIdentityOf(bNode);
check(bBound && bBound.subject !== bound?.subject,
  'GATE1 non-vacuity: a different subject binds a DIFFERENT identity',
  `A=${bound?.subject} B=${bBound?.subject}`);

// key reuse must not inherit
tree.$.rows.removeOne('A'); await flush(n);
const p3 = tree.transact(() => tree.$.rows.addOne({ id:'A', name:'fresh', score:9 }));
await flush(n);
const [t3] = runtime.getPendingTurnIds();
const addFx3 = runtime.describePendingTurn(t3).effects.find(e=>e.kind==='add');
const freshNode = K.__spikeCaptureReads(() => tree.$.rows.byIdOrFail('A'))[0];
const freshBound = K.__spikeIdentityOf(freshNode);
check(freshBound?.subject === addFx3?.subject && freshBound?.subject !== bound?.subject,
  'GATE1 key reuse: fresh anchor binds the FRESH effect subject, not the old one',
  `old=${bound?.subject} freshEffect=${addFx3?.subject} freshBound=${freshBound?.subject}`);
try { p3.confirm(); } catch {}

// ---- GATE 2: SCALAR ROW ----
const p4 = tree.transact(() => tree.$.x(5));
await flush(n);
const [t4] = runtime.getPendingTurnIds();
const sFx = runtime.describePendingTurn(t4).effects.find(e=>e.kind==='set');
const xNode = K.__spikeCaptureReads(() => tree.$.x())[0];
const xBound = K.__spikeIdentityOf(xNode);
console.log(`scalar effect position=${sFx?.position}   x binding: ${JSON.stringify(xBound)}`);
check(!!xBound, 'GATE2 SCALAR ROW: the scalar node has a bound identity', JSON.stringify(xBound) ?? 'undefined');
check(xBound?.kind === 'scalar' && Array.isArray(xBound?.positions) && xBound.positions.includes(sFx?.position),
  'GATE2 SCALAR EQUALITY: effect position is among the scalar node bound positions',
  `effect=${sFx?.position} bound=${JSON.stringify(xBound?.positions)}`);
try { p4.confirm(); } catch {}
tree.destroy();

writeFileSync(resolve(here,'c-spike.json'), JSON.stringify({probe:'C-SPIKE-GATES',checks},null,2)+'\n');
const failed = checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} gates passed`);
process.exit(failed.length?1:0);
