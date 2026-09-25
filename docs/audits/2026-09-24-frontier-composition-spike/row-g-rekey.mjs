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
    resolveDir: root, sourcefile: 'rowg.ts', loader: 'ts' },
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

const flushN=async n=>{n.flushSync();for(let i=0;i<12;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

// ROW G — does an OBLIGATION follow the subject LIFETIME through a rekey, and
// fail to follow a reused business key? Identity was proven in DEPENDENCY-1F;
// this asks the same of the obligation carried on that identity.
const live=new Set(['O1']); const carried=new Map();
const own=(sub,o)=>{const s=carried.get(sub)??new Set();s.add(o);carried.set(sub,s);};
const blockers=sub=>[...(carried.get(sub)??[])].filter(o=>live.has(o));

const n=K.getPathNotifier();
const tree=K.signalTree({rows:K.entityMap({selectId:r=>r.id})},{enhancers:[K.transactions()]});
const runtime=K.peekInternalTransactionRuntime(tree);
const anchorSubject=id=>{
  const [nd]=K.__spikeCaptureReads(()=>tree.$.rows.byIdOrFail(id));
  return K.__spikeIdentityOf(nd)?.subject;
};

const p1=tree.transact(()=>tree.$.rows.addOne({id:'A',name:'a',score:1}));
await flushN(n);
const [t1]=runtime.getPendingTurnIds();
const addFx=runtime.describePendingTurn(t1).effects.find(e=>e.kind==='add');
own(addFx.subject,'O1');                       // obligation carried by the SUBJECT
const atCreate=anchorSubject('A');
p1.confirm(); await flushN(n);

tree.$.rows.changeId('A','B'); await flushN(n);
const afterRekey=anchorSubject('B');

tree.$.rows.removeOne('B'); await flushN(n);
const p2=tree.transact(()=>tree.$.rows.addOne({id:'B',name:'fresh',score:9}));
await flushN(n);
const [t2]=runtime.getPendingTurnIds();
const freshFx=runtime.describePendingTurn(t2).effects.find(e=>e.kind==='add');
const freshSubject=anchorSubject('B');
try{p2.confirm();}catch{}

console.log(`subject at create=${atCreate}  after rekey A->B=${afterRekey}  fresh at reused key B=${freshSubject}`);
console.log(`blockers: original=${JSON.stringify(blockers(atCreate))}  fresh=${JSON.stringify(blockers(freshSubject))}\n`);
check(atCreate!==undefined && afterRekey===atCreate,
  'ROW G the obligation-carrying SUBJECT identity survives rekey A->B',`${atCreate} -> ${afterRekey}`);
check(blockers(afterRekey).includes('O1'),
  'ROW G ...so the obligation still applies after the business key moved');
check(freshSubject!==undefined && freshSubject!==atCreate,
  'ROW G a fresh subject at the REUSED key has a different subject identity',
  `old=${atCreate} fresh=${freshSubject}`);
check(blockers(freshSubject).length===0,
  'ROW G ...and carries NO obligation inherited from the old lifetime',
  `blockers=${JSON.stringify(blockers(freshSubject))}`);
check(freshFx?.subject !== addFx?.subject,
  'ROW G non-vacuity: the kernel itself reports distinct subjects for the two lifetimes',
  `old=${addFx?.subject} fresh=${freshFx?.subject}`);
tree.destroy();

writeFileSync(resolve(here,'row-g-rekey.json'),JSON.stringify({probe:'ROW-G',atCreate,afterRekey,freshSubject,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
