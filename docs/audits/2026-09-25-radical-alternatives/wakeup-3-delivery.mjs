#!/usr/bin/env node
// WAKEUP-3 — does the F5 gate DELIVER, with zero pulls?
//
// WAKEUP-2 asserted exposable('x')===1. That is the MODEL's opinion, not Link's
// delivery, and it also wrote x twice beforehand, which spoils it as a zero-pull
// test. This asserts the only thing that matters:
//
//     resolve the obligation
//     perform NO write and NO read of x
//     flush the real notifier
//     require a Link delivery of x=1
//
// Two arms, because they exercise different release paths:
//   A  the tree becomes QUIESCENT      the kernel's own hold can release
//   B  another turn stays OPEN          only the gate can release
//
// B is the real question. If it fails, F5 needs a push mechanism identified
// before Candidate C and contribution-store can be compared on delivery.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-w3-'));
const CC='packages/kernel/src/lib/internals/commit-consequence.ts';
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
    resolveDir:root,sourcefile:'w3.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
  plugins:[{name:'gate',setup(b){ b.onLoad({filter:/commit-consequence\.ts$/},({path})=>{
    if(relative(root,path)!==CC) return null;
    const s=readFileSync(path,'utf8');
    const a='  if (scopeKey && hasOpen(scopeKey)) {';
    if(!s.includes(a)) throw new Error('ANCHOR MISS hold');
    // The F5 gate: a spike scheduler may take ownership of the consequence.
    return {contents:s.replace(a,
      `  const __sched = (globalThis as never as {__stGate?: (c: unknown, r: () => void) => boolean}).__stGate;\n  if (__sched && __sched(claimant, run)) return;\n  if (scopeKey && hasOpen(scopeKey)) {`),
      loader:'ts',resolveDir:dirname(path)}; }); }}],
});
const p=resolve(out,'w3.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const flush=async n=>{n.flushSync();for(let i=0;i<16;i++)await Promise.resolve();};

const run=async({keepAnotherTurnOpen})=>{
  const n=K.getPathNotifier();
  const tree=K.signalTree({x:0,z:0},{enhancers:[K.transactions()]});
  const sent=[]; const parked=[];
  let blocked=true;
  // The F5 gate: park the consequence while blocked; run it on release.
  globalThis.__stGate=(claimant,runFn)=>{
    if(claimant!==tree.$.x) return false;          // only gate x
    if(!blocked){ runFn(); return true; }
    parked.push(runFn); return true; };
  const lx=K.link(tree.$.x,{set:v=>sent.push(v)});
  await flush(n); sent.length=0;

  const p1=tree.transact(()=>tree.$.x(1));
  await flush(n);
  const whileBlocked=[...sent];
  let p2;
  if(keepAnotherTurnOpen){ p2=tree.transact(()=>tree.$.z(9)); await flush(n); }

  // RESOLVE. From here: no write of x, no read of x, no pump.
  p1.confirm();
  blocked=false;
  for(const r of parked.splice(0)) r();            // the gate releases what it parked
  await flush(n);
  const afterResolve=[...sent];
  const stillOpen = K.peekInternalTransactionRuntime(tree).getPendingTurnIds().length;
  try{ p2?.confirm(); }catch{}
  lx.dispose(); tree.destroy(); globalThis.__stGate=undefined;
  return {whileBlocked,afterResolve,stillOpen,parkedCount:parked.length};
};

const A=await run({keepAnotherTurnOpen:false});
const B=await run({keepAnotherTurnOpen:true});
console.log(`A quiescent      blocked=${JSON.stringify(A.whileBlocked)} after=${JSON.stringify(A.afterResolve)}`);
console.log(`B another open   blocked=${JSON.stringify(B.whileBlocked)} after=${JSON.stringify(B.afterResolve)} otherTurnsStillOpen=${B.stillOpen}\n`);
check(A.whileBlocked.length===0,'A speculative x is withheld while blocked',`sent=${JSON.stringify(A.whileBlocked)}`);
check(A.afterResolve.includes(1),
  'A DELIVERY: Link receives x=1 after release, with NO write or read of x',
  `sent=${JSON.stringify(A.afterResolve)}`);
check(B.whileBlocked.length===0,'B withheld while blocked, with another turn open');
check(B.afterResolve.includes(1),
  'B DELIVERY while ANOTHER TURN IS STILL OPEN -- only the gate can release here',
  `sent=${JSON.stringify(B.afterResolve)} otherOpen=${B.stillOpen}`);
writeFileSync(resolve(here,'wakeup-3-delivery.json'),JSON.stringify({probe:'WAKEUP-3',A,B,checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
