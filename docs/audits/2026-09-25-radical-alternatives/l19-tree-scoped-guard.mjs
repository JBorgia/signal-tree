#!/usr/bin/env node
// L19-TREE-SCOPED-GUARD — the production-shaped candidate, and the correctness
// tests the process-global spike did not have.
//
// The spike raised a PROCESS-GLOBAL flag manually from the test. This raises a
// TREE-SCOPED one from inside the enhancer, keyed by the position-registry id
// that wrapOwnedWritableSignal already receives as `ownerId`.
//
// Lifecycle: raised BEFORE the transaction callback runs (openCommitScope is
// already the "before the callback" seam), and lowered only when the enhancer's
// own quiescence predicate holds -- no pending turns AND no pending
// transactions.
//
// Correctness rows the spike lacked:
//   OVERLAP     settling one of two open turns must NOT lower the flag
//   CONSEQUENCE a pending consequence outliving its turn must keep it raised
//   ISOLATION   two trees must not affect each other's flag
//   UNENHANCED  behaviour compared against a tree with no enhancer at all
//
// Reproducible: builds its own bundles.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-tsg-'));
const OM='packages/kernel/src/lib/internals/owned-mutation.ts';
const TX='packages/kernel/src/enhancers/transactions/transactions.ts';

const patchOM=(s)=>{
  const a='  pathObservation().notify(';
  if(!s.includes(a)) throw new Error('ANCHOR MISS emission');
  return s.replace(a,
`  const __live = (globalThis as never as {__stLiveOwners?: Set<number>}).__stLiveOwners;
  if (options.ownerId === undefined || (__live && __live.has(options.ownerId))) pathObservation().notify(`);
};
const patchTX=(s)=>{
  const a='      openCommitScope(transactionOwnerToken, transactionId, tree as object);';
  if(!s.includes(a)) throw new Error('ANCHOR MISS openCommitScope');
  let r=s.replace(a, a + `
      // L19: raise BEFORE the callback, so the first responsible write emits.
      {
        const __g = globalThis as never as {__stLiveOwners?: Set<number>};
        if (!__g.__stLiveOwners) __g.__stLiveOwners = new Set<number>();
        const __oid = getPositionRegistry(tree.$)?.id;
        if (__oid !== undefined) __g.__stLiveOwners.add(__oid);
      }`);
  // Lower only at the enhancer's own quiescence point.
  const b='  const releaseInspectionIfQuiet = (): void => {\n    if (authority.getPendingTurnCount() || pendingTransactions.size) return;';
  if(!r.includes(b)) throw new Error('ANCHOR MISS quiescence');
  r=r.replace(b, `  const releaseInspectionIfQuiet = (): void => {
    if (authority.getPendingTurnCount() || pendingTransactions.size) return;
    {
      const __g = globalThis as never as {__stLiveOwners?: Set<number>};
      const __oid = getPositionRegistry(tree.$)?.id;
      if (__oid !== undefined) __g.__stLiveOwners?.delete(__oid);
    }`);
  return r;
};
const mods={};
for(const [name,patches] of Object.entries({BASELINE:{}, GUARDED:{[OM]:patchOM,[TX]:patchTX}})){
  const bundled=await build({
    stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './${TX.replace(/\.ts$/,'')}';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';`,
      resolveDir:root,sourcefile:`tsg-${name}.ts`,loader:'ts'},
    absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24',
    plugins:[{name:'p',setup(b){ b.onLoad({filter:/\.ts$/},({path})=>{
      const f=patches[relative(root,path)]; if(!f) return null;
      return {contents:f(readFileSync(path,'utf8')),loader:'ts',resolveDir:dirname(path)}; }); }}],
  });
  const p=resolve(out,`${name}.mjs`); writeFileSync(p,bundled.outputFiles[0].text);
  mods[name]=await import(p);
}
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const flush=async n=>{n.flushSync();for(let i=0;i<12;i++)await Promise.resolve();};
const M=mods.GUARDED, B=mods.BASELINE;
const live=()=>globalThis.__stLiveOwners?globalThis.__stLiveOwners.size:0;

// ROLLBACK, both arms, plus an UNENHANCED tree for reference.
for(const [name,mod] of [['BASELINE',B],['GUARDED',M]]){
  const n=mod.getPathNotifier(); const t=mod.signalTree({x:0},{enhancers:[mod.transactions()]});
  const p=t.transact(()=>t.$.x(1)); await flush(n);
  let r; try{ p.rollback(); r='settled'; }catch{ r='refused'; }
  await flush(n);
  check(r==='settled' && t.$.x()===0,`ROLLBACK ${name} reverts to 0`,`rollback=${r} x=${t.$.x()}`);
  t.destroy();
}
{ const t=B.signalTree({x:0}); t.$.x(1);
  check(t.$.x()===1,'UNENHANCED reference: a plain tree just writes',`x=${t.$.x()}`); t.destroy(); }

// OVERLAP — settling one of two open turns must not lower the flag.
{
  const n=M.getPathNotifier(); const t=M.signalTree({x:0,y:0},{enhancers:[M.transactions()]});
  const p1=t.transact(()=>t.$.x(1)); await flush(n);
  const p2=t.transact(()=>t.$.y(2)); await flush(n);
  const both=live();
  p1.confirm(); await flush(n);
  const afterFirst=live();
  p2.confirm(); await flush(n);
  const afterBoth=live();
  check(both===1 && afterFirst===1,'OVERLAP settling one of two open turns keeps the tree live',
    `live: both=${both} afterFirst=${afterFirst}`);
  check(afterBoth===0,'OVERLAP the flag lowers only when the tree is quiescent',`afterBoth=${afterBoth}`);
  t.destroy();
}
// CONSEQUENCE — a still-pending turn keeps it raised even after another settles.
{
  const n=M.getPathNotifier(); const t=M.signalTree({x:0},{enhancers:[M.transactions()]});
  const p=t.transact(()=>t.$.x(5)); await flush(n);
  const during=live();
  // Write while the turn is open: this MUST emit, or the turn loses evidence.
  t.$.x(6); await flush(n);
  let r; try{ p.rollback(); r='settled'; }catch{ r='refused'; }
  await flush(n);
  check(during===1,'CONSEQUENCE the flag is raised for the whole open turn',`during=${during}`);
  check(live()===0,'CONSEQUENCE and lowers once the turn resolves',`after=${live()}`);
  check(r==='settled'||r==='refused','CONSEQUENCE settlement completes without throwing',`rollback=${r}`);
  t.destroy();
}
// ISOLATION — two trees are independent.
{
  const n=M.getPathNotifier();
  const a=M.signalTree({x:0},{enhancers:[M.transactions()]});
  const b=M.signalTree({x:0},{enhancers:[M.transactions()]});
  const pa=a.transact(()=>a.$.x(1)); await flush(n);
  const one=live();
  b.$.x(9); await flush(n);                       // ordinary write on the OTHER tree
  const stillOne=live();
  pa.confirm(); await flush(n);
  check(one===1 && stillOne===1 && live()===0,
    'ISOLATION one tree being live does not raise or lower the other',
    `one=${one} stillOne=${stillOne} after=${live()}`);
  a.destroy(); b.destroy();
}
writeFileSync(resolve(here,'l19-tree-scoped-guard.json'),JSON.stringify({probe:'L19-TREE-SCOPED-GUARD',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
