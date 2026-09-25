#!/usr/bin/env node
// L19-DORMANT-GUARD — test a candidate repair for BOTH correctness and cost.
//
// GUARD: emit a path notification only when the tree has live causal
// responsibility -- an open transaction or any pending turn. A dormant tree
// emits nothing.
//
// CORRECTNESS GATE, recorded before implementing: the guard must be active
// BEFORE the first write that creates causal responsibility, and remain active
// until every pending transaction and consequence has resolved. A guard that
// misses the write which opened the responsibility loses causal evidence
// SILENTLY, which is worse than the cost it saves.
//
// Measured at dormant, 1% active and fully active, because a repair that fixes
// dormant by taxing active has only moved the cost.
//
// Reproducible: builds every bundle it needs.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-guard-'));
const OM='packages/kernel/src/lib/internals/owned-mutation.ts';

// The guard consults a per-process liveness flag the transactions enhancer
// maintains. In production this would be tree-scoped; the flag is enough to
// answer the cost and correctness questions.
const guarded=(s)=>{
  const a='  pathObservation().notify(';
  if(!s.includes(a)) throw new Error('ANCHOR MISS emission');
  return s.replace(a,
    '  if ((globalThis as never as {__stCausalLive?: number}).__stCausalLive) pathObservation().notify('); };

const mods={};
for(const [name,patch] of Object.entries({BASELINE:null,GUARDED:guarded})){
  const bundled=await build({
    stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
      resolveDir:root,sourcefile:`guard-${name}.ts`,loader:'ts'},
    absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
    plugins: patch?[{name:'guard',setup(b){ b.onLoad({filter:/owned-mutation\.ts$/},({path})=>{
      if(relative(root,path)!==OM) return null;
      return {contents:patch(readFileSync(path,'utf8')),loader:'ts',resolveDir:dirname(path)}; }); }}]:[],
  });
  const p=resolve(out,`${name}.mjs`); writeFileSync(p,bundled.outputFiles[0].text);
  mods[name]=await import(p);
}
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const flush=async n=>{n.flushSync();for(let i=0;i<10;i++)await Promise.resolve();};

// ---------- CORRECTNESS ----------
// The flag must be raised BEFORE the write inside transact(), not after.
for(const [name,M] of Object.entries(mods)){
  const n=M.getPathNotifier();
  const tree=M.signalTree({x:0},{enhancers:[M.transactions()]});
  const rt=M.peekInternalTransactionRuntime(tree);
  globalThis.__stCausalLive=0;
  const p=tree.transact(()=>{ globalThis.__stCausalLive=1; tree.$.x(1); });  // raised BEFORE the write
  await flush(n);
  const pendingSeen=rt.getPendingTurnIds().length;
  let rolled;
  try{ p.rollback(); rolled='settled'; }catch{ rolled='refused'; }
  await flush(n);
  globalThis.__stCausalLive=0;
  check(pendingSeen===1 && rolled==='settled' && tree.$.x()===0,
    `CORRECTNESS ${name}: the turn is recorded and rolls back to 0`,
    `pendingTurns=${pendingSeen} rollback=${rolled} x=${tree.$.x()}`);
  tree.destroy();
}
// The failure mode the gate exists for: flag raised AFTER the write.
{
  const M=mods.GUARDED; const n=M.getPathNotifier();
  const tree=M.signalTree({x:0},{enhancers:[M.transactions()]});
  const rt=M.peekInternalTransactionRuntime(tree);
  globalThis.__stCausalLive=0;
  const p=tree.transact(()=>{ tree.$.x(1); globalThis.__stCausalLive=1; });  // raised LATE
  await flush(n);
  let rolled; try{ p.rollback(); rolled='settled'; }catch{ rolled='refused'; }
  await flush(n);
  const lost = tree.$.x()!==0;
  check(lost,
    'GATE a guard raised AFTER the write LOSES causal evidence silently -- x does not revert',
    `x=${tree.$.x()} rollback=${rolled} (this is the failure the gate forbids)`);
  globalThis.__stCausalLive=0; tree.destroy();
}

// ---------- COST at three activity levels ----------
const N=200000, TRIALS=11, DISCARD=3;
const q=(a,f)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(s.length*f))];};
const median=a=>q(a,0.5); const relIQR=a=>(q(a,0.75)-q(a,0.25))/median(a)*100;
const run=(M,live,activeEvery)=>{
  const tree=M.signalTree({a:0},{enhancers:[M.transactions()]});
  globalThis.__stCausalLive=live?1:0;
  const t0=process.hrtime.bigint();
  for(let i=0;i<N;i++){
    if(activeEvery && i%activeEvery===0){ const p=tree.transact(()=>tree.$.a(i)); p.confirm(); }
    else tree.$.a(i);
  }
  const ms=Number(process.hrtime.bigint()-t0)/1e6;
  globalThis.__stCausalLive=0; tree.destroy(); return ms;
};
const LEVELS={ dormant:[false,0], 'active-1%':[true,100], 'active-100%':[true,1] };
const arms=[];
for(const lvl of Object.keys(LEVELS)) for(const name of ['BASELINE','GUARDED']) arms.push([lvl,name]);
const raw=Object.fromEntries(arms.map(a=>[a.join('/'),[]]));
for(let w=0;w<2;w++) for(const [lvl,name] of arms){ const [live,ev]=LEVELS[lvl]; run(mods[name],live,ev); }
for(let i=0;i<TRIALS;i++){
  const order = i%2===0?arms:[...arms].reverse();
  for(const [lvl,name] of order){ const [live,ev]=LEVELS[lvl]; raw[`${lvl}/${name}`].push(run(mods[name],live,ev)); }
}
console.log(`\n${'level'.padEnd(14)}${'BASELINE'.padStart(11)}${'GUARDED'.padStart(11)}${'delta'.padStart(9)}`);
const summary={};
for(const lvl of Object.keys(LEVELS)){
  const b=median(raw[`${lvl}/BASELINE`].slice(DISCARD)), g=median(raw[`${lvl}/GUARDED`].slice(DISCARD));
  summary[lvl]={baseline:b,guarded:g,delta:(g-b)/b*100};
  console.log(`${lvl.padEnd(14)}${b.toFixed(1).padStart(9)}ms${g.toFixed(1).padStart(9)}ms${(((g-b)/b*100).toFixed(0)+'%').padStart(9)}`);
}
check(summary.dormant.delta < -40,'COST dormant is substantially cheaper with the guard',
  `${summary.dormant.delta.toFixed(0)}%`);
check(summary['active-100%'].delta < 25,'COST fully active is not materially penalised',
  `${summary['active-100%'].delta.toFixed(0)}%`);
writeFileSync(resolve(here,'l19-dormant-guard.json'),JSON.stringify({probe:'L19-DORMANT-GUARD',summary,checks,raw},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
