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
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads, __spikeIdentityOf} from './${LR.replace(/\.ts$/,'')}';`,
   resolveDir:root,sourcefile:'compound0.ts',loader:'ts'},
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
const K=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

const flushN=async n=>{n.flushSync();for(let i=0;i<14;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

// AUTHORITY is per semantic FACT, not per Link source:
//     SemanticFact -> Set<LiveObligation>
// A Link source keeps only a DERIVED projection of that -- a multiplicity per
// obligation over the facts its payload represents. The count is an efficient
// projection, never the truth.
//
// Wakeup is therefore broader than "the obligation terminated": a held
// consequence must be reconsidered whenever ANY of its fact->obligation
// relationships disappears, including when a fact stops carrying an obligation
// that remains live elsewhere.
const run = async ({ detachDropsWholeObligation, lateLink }) => {
  const live=new Set(), factObligations=new Map(), waiters=[], represented=new Map();
  const of=f=>factObligations.get(f)??new Set();
  const own=(f,o)=>{live.add(o);const s=of(f);s.add(o);factObligations.set(f,s);};
  const detach=(f,o)=>{ of(f).delete(o); reconsider(); };          // fact stops carrying o
  const terminate=o=>{ live.delete(o); reconsider(); };            // obligation resolves
  /** Derived projection: obligation -> how many represented facts still carry it. */
  const multiplicity=facts=>{
    const m=new Map();
    for(const f of facts) for(const o of of(f)) if(live.has(o)) m.set(o,(m.get(o)??0)+1);
    return m;
  };
  const blocked=facts=>{
    const m=multiplicity(facts);
    if(detachDropsWholeObligation){
      // MUTANT: treat any single detachment as clearing the obligation for the
      // whole source, ignoring the remaining carriers.
      return [...m.keys()].some(o=>m.get(o)>=2);
    }
    return m.size>0;
  };
  const reconsider=()=>{
    for(let i=waiters.length-1;i>=0;i--)
      if(!blocked(waiters[i].facts)){ const w=waiters.splice(i,1)[0]; w.runFn(); }
  };
  globalThis.__spikeSchedule=(claimant,runFn)=>{
    const facts=represented.get(claimant);
    if(!facts) return false;                       // unknown source -> kernel hold
    if(!blocked(facts)){ runFn(); return true; }
    waiters.push({facts,runFn});
    return true;
  };

  const n=K.getPathNotifier();
  const tree=K.signalTree({pair:{a:0,b:0},other:0},{enhancers:[K.transactions()]});
  const pos=path=>{const [nd]=K.__spikeCaptureReads(()=>path());return K.__spikeIdentityOf(nd)?.positions?.[0];};
  const aF=pos(()=>tree.$.pair.a()), bF=pos(()=>tree.$.pair.b()), oF=pos(()=>tree.$.other());

  // P1 is unresolved and its obligation is carried by THREE facts: a, b and
  // other. `other` keeps O1 live globally even after a and b detach.
  const p1=tree.transact(()=>{ own(aF,'O1'); own(bF,'O1'); own(oF,'O1');
    tree.$.pair.a(1); tree.$.pair.b(2); tree.$.other(3); });
  await flushN(n);

  const sent=[]; let lp;
  const attach=()=>{ lp=K.link(tree.$.pair,{set:v=>sent.push(JSON.parse(JSON.stringify(v)))});
    represented.set(tree.$.pair,[aF,bF]); };
  if(!lateLink) attach();
  else { attach(); }   // both paths attach AFTER P1 opened: this IS the late-seed case
  await flushN(n);
  sent.length=0;                       // ignore the relationship-creation sync
  // A write AFTER attachment is what schedules a consequence for this source.
  // Without it there is no parked waiter and every later check is vacuous.
  tree.$.pair.a(11);
  await flushN(n);
  const afterAttach=[...sent];

  detach(aF,'O1'); await flushN(n);
  const afterFirstDetach=[...sent];
  detach(bF,'O1'); await flushN(n);
  const afterSecondDetach=[...sent];
  const o1StillLive=live.has('O1') && of(oF).has('O1');

  try{p1.confirm();}catch{}
  lp.dispose(); tree.destroy(); globalThis.__spikeSchedule=undefined;
  return {afterAttach,afterFirstDetach,afterSecondDetach,o1StillLive,parked:waiters.length};
};

const real=await run({});
const mutant=await run({detachDropsWholeObligation:true});
console.log(`REAL   attach=${JSON.stringify(real.afterAttach)} afterA=${JSON.stringify(real.afterFirstDetach)} afterB=${JSON.stringify(real.afterSecondDetach)} O1 still live=${real.o1StillLive}`);
console.log(`MUTANT attach=${JSON.stringify(mutant.afterAttach)} afterA=${JSON.stringify(mutant.afterFirstDetach)}\n`);
check(real.afterAttach.length===0,
  'LATE-LINK a source created AFTER P1 is pending seeds its blockers from live carriers');
check(real.afterFirstDetach.length===0,
  'MULTIPLICITY O1 x2 -> x1: one fact detaching does NOT release the source',
  `afterA=${JSON.stringify(real.afterFirstDetach)}`);
check(real.afterSecondDetach.length>0,
  'MULTIPLICITY O1 x0: the last represented carrier detaching WAKES the held consequence',
  `afterB=${JSON.stringify(real.afterSecondDetach)}`);
check(real.o1StillLive && real.afterSecondDetach.length>0,
  'BROADER WAKEUP the source woke WHILE O1 is still live on another fact',
  `woke=${real.afterSecondDetach.length>0} o1Live=${real.o1StillLive}`);
check(mutant.afterFirstDetach.length>0,
  'MUTANT dropping the obligation on first detach lets the branch escape early',
  `afterA=${JSON.stringify(mutant.afterFirstDetach)}`);

writeFileSync(resolve(here,'compound-source-0.json'),JSON.stringify({probe:'COMPOUND-SOURCE-0',real,mutant,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
