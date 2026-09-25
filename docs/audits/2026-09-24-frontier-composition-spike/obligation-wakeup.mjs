#!/usr/bin/env node
// F5 ABLATION — can dependency-scoped eligibility replace tree-scoped blocking?
//
//   CONTROL    stock hold                          -> x held, y HELD (the gap)
//   CANDIDATE  hold bypassed for eligible sources  -> x held, y DELIVERED
//   DEPENDENT  y derived from x, edge P2->P1       -> y HELD (correctly)
//   MUTANT     same, edge suppressed               -> y delivered (edge proven)
//
// Eligibility is decided ONLY from semantic identity: the claimant IS the
// linked source location, so it is read under capture, its node's bound
// identity is looked up, and that is compared against identities owned by open
// turns. No path comparison, no business key.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const LR='packages/kernel/src/lib/internals/location-runtime.ts';
const ST='packages/kernel/src/lib/signal-tree.ts';
const CC='packages/kernel/src/lib/internals/commit-consequence.ts';
const PT=[`  if (activeConsumer) {`,`    if (activeConsumer.__capture) {`,
`      let e = activeConsumer.dependencies.get(node);`,
`      if (!e) { const r = new WeakRef(activeConsumer); e = { reference: r, version: node.version };`,
`        node.consumers.add(r); activeConsumer.dependencies.set(node, e); } else { e.version = node.version; }`,
`      const outer = activeConsumer; activeConsumer = outer.__outer;`,
`      try { trackDependency(node, token); } finally { activeConsumer = outer; }`,
`      return;`,`    }`].join('\n');
const SEAM=`
const __spikeIdentity = new WeakMap();
export function __spikeCaptureReads(run) {
  const collected = new Map();
  const consumer = { dependencies: collected, level: 0, invalidate() {}, settle() {}, __capture: true, __outer: undefined };
  const previous = activeConsumer; consumer.__outer = previous; activeConsumer = consumer;
  try { run(); } finally { activeConsumer = previous;
    for (const n of collected.keys()) for (const r of n.consumers) if (r.deref() === consumer) n.consumers.delete(r); }
  return [...collected.keys()];
}
export function __spikeIdentityOf(node) { return __spikeIdentity.get(node); }
export function __spikeBindLocation(location, identity) {
  try { const [n] = __spikeCaptureReads(() => location()); if (n) __spikeIdentity.set(n, identity); } catch {}
}`;
const b=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads, __spikeIdentityOf} from './${LR.replace(/\.ts$/,'')}';`,
   resolveDir:root,sourcefile:'wake0.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
  plugins:[{name:'f5',setup(bb){
    bb.onLoad({filter:/location-runtime\.ts$/},({path})=>{ if(relative(root,path)!==LR) return null;
      const s=readFileSync(path,'utf8'); if(!s.includes('  if (activeConsumer) {')) throw new Error('MISS track');
      return {contents:s.replace('  if (activeConsumer) {',PT)+SEAM,loader:'ts',resolveDir:dirname(path)};});
    bb.onLoad({filter:/signal-tree\.ts$/},({path})=>{ if(relative(root,path)!==ST) return null;
      let s=readFileSync(path,'utf8'); const a=`  defineNodeAddress(leaf as object, address);`;
      if(!s.includes(a)) throw new Error('MISS leaf');
      s=s.replace(a,a+`\n  __spikeBindLocation(leaf as never, { kind: 'scalar', positions: [...(positionIds ?? [])] });`);
      return {contents:`import { __spikeBindLocation } from './internals/location-runtime';\n`+s,loader:'ts',resolveDir:dirname(path)};});
    bb.onLoad({filter:/commit-consequence\.ts$/},({path})=>{ if(relative(root,path)!==CC) return null;
      const s=readFileSync(path,'utf8'); const a=`  if (scopeKey && hasOpen(scopeKey)) {`;
      if(!s.includes(a)) throw new Error('MISS hold');
      // ABLATION: tree-scoped blocking, bypassed for sources C deems eligible.
      // The spike SCHEDULER takes ownership: it either runs the consequence now
      // or parks it as a waiter on its blocking obligations. Returning true
      // means the kernel's own hold must not also claim it.
      return {contents:s.replace(a,`  const __sched = (globalThis as never as {__spikeSchedule?: (c: unknown, r: () => void) => boolean}).__spikeSchedule;\n  if (__sched && __sched(claimant, run)) return;\n  if (scopeKey && hasOpen(scopeKey)) {`),loader:'ts',resolveDir:dirname(path)};});
  }}],
});
const K=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);

const flushN=async n=>{n.flushSync();for(let i=0;i<14;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

// OBLIGATION SCHEDULER. The one-way map source -> Set<Obligation> cannot wake
// anything; it needs the reverse relation. A parked consequence is a WAITER on
// each obligation blocking it, so resolving an obligation reconsiders exactly
// the consequences it was blocking -- no polling, no dependence on
// hasOpen(tree) going false, and no need for a later write.
const run = async ({ notifyWaiters }) => {
  const live=new Set(), carried=new Map(), waiters=[];
  const of=p=>carried.get(p)??new Set();
  const own=(p,o)=>{live.add(o);const s=of(p);s.add(o);carried.set(p,s);};
  const inherit=(to,from)=>{const s=of(to);for(const p of from)for(const o of of(p))s.add(o);carried.set(to,s);};
  const blockersFor=ps=>{const out=new Set();for(const p of ps)for(const o of of(p))if(live.has(o))out.add(o);return out;};
  const positionsOf=claimant=>{
    try{const [nd]=K.__spikeCaptureReads(()=>claimant());const id=K.__spikeIdentityOf(nd);
      return id&&id.kind==='scalar'?id.positions:null;}catch{return null;}
  };
  globalThis.__spikeSchedule=(claimant,runFn)=>{
    const ps=positionsOf(claimant);
    if(!ps) return false;                       // unknown shape -> kernel keeps its hold
    const b=blockersFor(ps);
    if(b.size===0){ runFn(); return true; }
    waiters.push({claimant,runFn,ps});
    return true;
  };
  const resolveObligation=o=>{
    live.delete(o);
    if(!notifyWaiters) return;                  // MUTANT: no wakeup
    for(let i=waiters.length-1;i>=0;i--){
      if(blockersFor(waiters[i].ps).size===0){ const w=waiters.splice(i,1)[0]; w.runFn(); }
    }
  };

  const n=K.getPathNotifier();
  const tree=K.signalTree({x:0,y:0,z:0},{enhancers:[K.transactions()]});
  const sent=[]; const ly=K.link(tree.$.y,{set:v=>sent.push(v)});
  await flushN(n); sent.length=0;
  const pos=k=>{const [nd]=K.__spikeCaptureReads(()=>tree.$[k]());return K.__spikeIdentityOf(nd)?.positions??[];};
  const xPos=pos('x'), yPos=pos('y'), zPos=pos('z');

  const p1=tree.transact(()=>{ for(const p of xPos) own(p,'O1'); tree.$.x(1); });
  await flushN(n);
  const p2=tree.transact(()=>{ tree.$.y(tree.$.x()+1); inherit(yPos[0],xPos); });   // y = 2
  await flushN(n); p2.confirm(); await flushN(n);
  const p3=tree.transact(()=>{ for(const p of zPos) own(p,'O3'); tree.$.z(9); });   // unrelated, stays OPEN
  await flushN(n);
  const beforeResolve=[...sent];

  // P1 resolves. NO NEW WRITE TO y. P3 is still open, so the tree-wide hold is
  // still active and cannot be what releases anything.
  resolveObligation('O1');
  await flushN(n);
  const afterResolve=[...sent];
  const p3Open=K.peekInternalTransactionRuntime(tree).getPendingTurnIds().length>0;
  try{p3.confirm();}catch{} try{p1.confirm();}catch{}
  ly.dispose(); tree.destroy(); globalThis.__spikeSchedule=undefined;
  return {beforeResolve,afterResolve,p3Open,parked:waiters.length};
};

const real=await run({notifyWaiters:true});
const mutant=await run({notifyWaiters:false});
console.log(`REAL   before=${JSON.stringify(real.beforeResolve)} after=${JSON.stringify(real.afterResolve)} p3StillOpen=${real.p3Open}`);
console.log(`MUTANT before=${JSON.stringify(mutant.beforeResolve)} after=${JSON.stringify(mutant.afterResolve)} parked=${mutant.parked}\n`);
check(real.beforeResolve.length===0,'held while O1 is unresolved');
check(real.p3Open,'an unrelated contribution is STILL OPEN, so the tree-wide hold cannot be the releaser');
check(real.afterResolve.includes(2),
  'WAKEUP resolving O1 releases the ALREADY-HELD consequence y=2 with NO new write',
  `after=${JSON.stringify(real.afterResolve)}`);
check(mutant.afterResolve.length===0,
  'MUTANT without waiter notification the held consequence stays stuck',
  `after=${JSON.stringify(mutant.afterResolve)} parked=${mutant.parked}`);

writeFileSync(resolve(here,'obligation-wakeup.json'),JSON.stringify({probe:'OBLIGATION-WAKEUP',real,mutant,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
