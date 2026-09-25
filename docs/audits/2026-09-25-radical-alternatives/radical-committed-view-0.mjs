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
   resolveDir:root,sourcefile:'rcv0.ts',loader:'ts'},
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

// A COMMITTED-ONLY projection: current value, except at positions a still-open
// turn owns, where the committed truth is the value from before that turn.
// Nothing is ever HELD -- the consumer simply never sees speculative state.
const scenario = async (dependent) => {
  const owned=new Map();          // position -> value before the open turn
  const sent=[];
  globalThis.__spikeSchedule=(claimant,runFn)=>{
    try{
      const [nd]=K.__spikeCaptureReads(()=>claimant());
      const id=K.__spikeIdentityOf(nd);
      if(!id||id.kind!=='scalar') return false;
      const pos=id.positions[0];
      const committed = owned.has(pos) ? owned.get(pos) : claimant();
      // Emit the COMMITTED value, and only when it actually changed.
      const last = sent.length ? sent[sent.length-1] : undefined;
      if(committed!==last) sent.push(committed);
      void runFn;                 // the real consequence is replaced, not deferred
      return true;
    }catch{ return false; }
  };
  const n=K.getPathNotifier();
  const tree=K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
  const pos=k=>{const [nd]=K.__spikeCaptureReads(()=>tree.$[k]());return K.__spikeIdentityOf(nd)?.positions?.[0];};
  const xPos=pos('x'), yPos=pos('y');
  const target = dependent ? 'y' : 'y';
  const ly=K.link(tree.$[target],{set:()=>{}});
  await flushN(n); sent.length=0;

  const p1=tree.transact(()=>{ owned.set(xPos,0); tree.$.x(1); });     // x pending
  await flushN(n);
  if(dependent){
    // P2 derives y from the UNCOMMITTED x, then CONFIRMS. y is now canonical.
    const p2=tree.transact(()=>{ owned.set(yPos,0); tree.$.y(tree.$.x()+1); });
    await flushN(n);
    owned.delete(yPos);                 // P2 settled: y is committed truth now
    p2.confirm(); tree.$.y(tree.$.y());
    await flushN(n);
  } else {
    tree.$.y(7);                        // ordinary settled work, unrelated to x
    await flushN(n);
  }
  // What would the committed projection REPORT for y now? The scheduled-
  // consequence path above cannot reach this state (a same-value write schedules
  // nothing), so the model is interrogated directly rather than inferred.
  const committedY = owned.has(yPos) ? owned.get(yPos) : tree.$.y();
  const out=[...sent];
  try{p1.confirm();}catch{}
  ly.dispose(); tree.destroy(); globalThis.__spikeSchedule=undefined;
  return { sent: out, committedY };
};

const independent = await scenario(false);
const derived     = await scenario(true);
console.log(`F5-A independent  y exported: ${JSON.stringify(independent.sent)}`);
console.log(`F5-B derived      y exported: ${JSON.stringify(derived.sent)}  committed view reports y=${derived.committedY}`);
console.log(`                  (x is still PENDING and uncommitted)\n`);

check(independent.sent.includes(7),
  'F5-A DISSOLVED committed-view exports independent y=7 with NO blocker machinery',
  `sent=${JSON.stringify(independent)}`);
check(derived.committedY !== 2,
  'F5-B committed-view must not treat y=2 as committed truth while x is uncommitted',
  `committed view reports y=${derived.committedY}`);

writeFileSync(resolve(here,'radical-committed-view-0.json'),
  JSON.stringify({probe:'RADICAL-COMMITTED-VIEW-0',independent,derived,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
