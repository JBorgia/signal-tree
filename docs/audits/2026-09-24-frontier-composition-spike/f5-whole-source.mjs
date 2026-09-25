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
   resolveDir:root,sourcefile:'f5c2.ts',loader:'ts'},
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

const run=async({eligibility,linkWhole})=>{
  const openPositions=new Set();
  globalThis.__spikeEligible = eligibility ? (claimant)=>{
    try{
      // A source is eligible only if EVERY location it reads is unowned. For a
      // whole-object source that means reading the object pulls in each leaf,
      // so a single pending leaf makes the whole source ineligible -- which is
      // the correct answer, since it cannot emit committed y with withheld x
      // without fabricating a snapshot that never existed.
      const nodes=K.__spikeCaptureReads(()=>claimant());
      if(!nodes.length) return false;
      for(const nd of nodes){
        const id=K.__spikeIdentityOf(nd);
        if(!id||id.kind!=='scalar') return false;
        if(id.positions.some(p=>openPositions.has(p))) return false;
      }
      return true;
    }catch{ return false; }
  } : undefined;
  const n=K.getPathNotifier();
  const tree=K.signalTree({x:0,y:0,other:{b:0}},{enhancers:[K.transactions()]});
  const sentWhole=[],sentOther=[];
  // WHOLE-SOURCE: contains the pending x. OTHER: an object source that does not.
  const lw=K.link(linkWhole?tree.$:tree.$.other,{set:v=>sentWhole.push(JSON.parse(JSON.stringify(v)))});
  const lo=K.link(tree.$.other,{set:v=>sentOther.push(JSON.parse(JSON.stringify(v)))});
  await flush(n); sentWhole.length=0; sentOther.length=0;
  const [xn]=K.__spikeCaptureReads(()=>tree.$.x());
  const xPositions=K.__spikeIdentityOf(xn)?.positions??[];
  const p1=tree.transact(()=>{ for(const p of xPositions) openPositions.add(p); tree.$.x(1); });
  await flush(n);
  tree.$.other.b(42);                 // settled work inside the OTHER source
  await flush(n);
  const before={whole:[...sentWhole],other:[...sentOther]};
  p1.confirm(); await flush(n);
  const after={whole:[...sentWhole],other:[...sentOther]};
  lw.dispose(); lo.dispose(); tree.destroy(); globalThis.__spikeEligible=undefined;
  return {before,after};
};

{ // diagnostic: does reading a BRANCH register leaf identities at all?
  const t=K.signalTree({x:0,other:{b:0}},{enhancers:[K.transactions()]});
  const branchNodes=K.__spikeCaptureReads(()=>t.$.other);
  const leafNodes=K.__spikeCaptureReads(()=>t.$.other.b());
  console.log(`  [diag] reading branch tree.$.other -> ${branchNodes.length} node(s); reading .b() -> ${leafNodes.length} node(s)`);
  t.destroy();
}
const whole=await run({eligibility:true,linkWhole:true});
const other=await run({eligibility:true,linkWhole:false});
const leaked=whole.before.whole.some(v=>v && v.x===1);
console.log(`WHOLE-SOURCE link(tree.$)      before=${JSON.stringify(whole.before.whole)}`);
console.log(`                                after=${JSON.stringify(whole.after.whole).slice(0,80)}`);
console.log(`OTHER object source            before=${JSON.stringify(other.before.other)}\n`);
check(!leaked,'F5-C SAFETY a whole-object source never emits speculative x=1',
  `before=${JSON.stringify(whole.before.whole)}`);
check(whole.before.whole.length===0,'F5-C a whole-object source containing pending state stays HELD');
check(whole.after.whole.length>0,'F5-C ...and is released once the pending state settles',
  `after=${JSON.stringify(whole.after.whole).slice(0,60)}`);
check(other.before.other.some(v=>v&&v.b===42),
  'F5-C NON-VACUITY an object source with NO pending state still progresses',
  `before=${JSON.stringify(other.before.other)}`);

writeFileSync(resolve(here,'f5-whole-source.json'),JSON.stringify({probe:'F5-C',whole,other,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
