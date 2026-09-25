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
export {transactions} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {__spikeCaptureReads, __spikeIdentityOf} from './${LR.replace(/\.ts$/,'')}';`,
   resolveDir:root,sourcefile:'f5a.ts',loader:'ts'},
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
      return {contents:s.replace(a,`  const __elig = (globalThis as never as {__spikeEligible?: (c: unknown) => boolean}).__spikeEligible;\n  if (scopeKey && hasOpen(scopeKey) && !(__elig && __elig(claimant))) {`),loader:'ts',resolveDir:dirname(path)};});
  }}],
});
const K=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
const flush=async n=>{n.flushSync();for(let i=0;i<14;i++)await Promise.resolve();};
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const run=async({eligibility,dependent,suppressEdge})=>{
  const openPositions=new Set(); const edges=new Set();     // claimant-level edges
  globalThis.__spikeEligible = eligibility ? (claimant)=>{
    try{
      const [node]=K.__spikeCaptureReads(()=>claimant());
      const id=K.__spikeIdentityOf(node);
      if(!id||id.kind!=='scalar') return false;
      if(id.positions.some(p=>openPositions.has(p))) return false;  // owned by an open turn
      if(edges.has(claimant)) return false;                         // depends on one
      return true;
    }catch{ return false; }
  } : undefined;
  const n=K.getPathNotifier();
  const tree=K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
  const sentX=[],sentY=[];
  const lx=K.link(tree.$.x,{set:v=>sentX.push(v)});
  const ly=K.link(tree.$.y,{set:v=>sentY.push(v)});
  await flush(n); sentX.length=0; sentY.length=0;
  // P1 pending on x. Ownership MUST be registered before any consequence for x
  // can be scheduled -- registering it after the flush let the speculative
  // value escape, because eligibility was evaluated while x still looked
  // unowned. That ordering is a real design constraint, not just a probe
  // detail: a lagging owner index leaks speculative state through Link.
  const [xn]=K.__spikeCaptureReads(()=>tree.$.x());
  const xPositions=K.__spikeIdentityOf(xn)?.positions??[];
  const p1=tree.transact(()=>{ for(const p of xPositions) openPositions.add(p); tree.$.x(1); });
  await flush(n);
  if(dependent){
    // P2 derives y from x -> a real dependency on P1.
    const p2=tree.transact(()=>{ const nodes=K.__spikeCaptureReads(()=>{ tree.$.y(tree.$.x()+1); });
      const dependsOnOpen=nodes.some(nd=>{ const id=K.__spikeIdentityOf(nd);
        return id?.kind==='scalar' && id.positions.some(p=>openPositions.has(p)); });
      if(dependsOnOpen && !suppressEdge) edges.add(tree.$.y);
    });
    await flush(n);
    try{ p2.confirm(); }catch{}
  } else {
    tree.$.y(7);
  }
  await flush(n);
  const beforeSettle={x:[...sentX],y:[...sentY]};
  p1.confirm(); await flush(n);
  const afterSettle={x:[...sentX],y:[...sentY]};
  lx.dispose(); ly.dispose(); tree.destroy(); globalThis.__spikeEligible=undefined;
  return {beforeSettle,afterSettle};
};

const control  =await run({eligibility:false});
const candidate=await run({eligibility:true});
const depend   =await run({eligibility:true,dependent:true});
const mutant   =await run({eligibility:true,dependent:true,suppressEdge:true});
const P=o=>`x=${JSON.stringify(o.beforeSettle.x)} y=${JSON.stringify(o.beforeSettle.y)}`;
console.log(`CONTROL   ${P(control)}   afterConfirm y=${JSON.stringify(control.afterSettle.y)}`);
console.log(`CANDIDATE ${P(candidate)}`);
console.log(`DEPENDENT ${P(depend)}`);
console.log(`MUTANT    ${P(mutant)}\n`);

check(control.beforeSettle.y.length===0,'CONTROL independent y is HELD (the measured gap)');
check(control.afterSettle.y.includes(7),'CONTROL RELEASE y is delivered after P1 confirms (held, not dropped)',
  `afterConfirm=${JSON.stringify(control.afterSettle.y)}`);
check(candidate.beforeSettle.x.length===0,'CANDIDATE SAFETY speculative x is still withheld');
check(candidate.beforeSettle.y.includes(7),'CANDIDATE CAPABILITY independent y progresses before P1 settles');
check(depend.beforeSettle.y.length===0,'DEPENDENT y derived from pending x is correctly HELD');
check(mutant.beforeSettle.y.length>0,'MUTANT without the edge the dependent y wrongly escapes (edge is load-bearing)');

writeFileSync(resolve(here,'f5-ablation.json'),JSON.stringify({probe:'F5-ABLATION',control,candidate,depend,mutant,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
