#!/usr/bin/env node
// WAKEUP-2 — resolve WAKEUP-1P's premise failure.
//
// link() refuses a derived frontier: it settles against what it observes, and a
// computed has no settlement identity. Three options were recorded:
//
//   (a) make the exposable frontier an OWNED location
//   (b) extend Link to accept derived locations
//   (c) keep the F5 ELIGIBILITY GATE: Link observes the ordinary location and a
//       gate decides consequence scheduling
//
// (b) is out of scope here -- it changes Link's settlement contract, which is a
// semantics decision, not something to settle by spike.
//
// This tests whether (a) is even constructible, and whether (c) carries the
// contribution-store STATE model (base + contributions, two selections) without
// needing Link to consume a derived value at all.
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url)); const root=resolve(here,'../../..');
const out=mkdtempSync(resolve(tmpdir(),'st-w2-'));
const bundled=await build({
  stdin:{contents:`export {signalTree} from './packages/kernel/src/index';
export {transactions, peekInternalTransactionRuntime} from './packages/kernel/src/enhancers/transactions/transactions';
export {link} from './packages/kernel/src/lib/link';
export {getPathNotifier} from './packages/kernel/src/lib/path-notifier';
export {computed} from '@angular/core';`,
    resolveDir:root,sourcefile:'w2.ts',loader:'ts'},
  absWorkingDir:root,bundle:true,write:false,platform:'node',format:'esm',target:'node24'});
const p=resolve(out,'w2.mjs'); writeFileSync(p,bundled.outputFiles[0].text);
const K=await import(p);
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};
const flush=async n=>{n.flushSync();for(let i=0;i<14;i++)await Promise.resolve();};

// ---- (a) can a derived be linked at all, and can an owned one be added late?
{
  const tree=K.signalTree({o1:true,y:2},{enhancers:[K.transactions()],
    derived:($)=>({yExposable:K.computed(()=>$.o1()?0:$.y())})});
  let derivedLinkErr=null;
  try{ K.link(tree.$.yExposable,{set:()=>{}}); }catch(e){ derivedLinkErr=String(e.message).slice(0,70); }
  check(derivedLinkErr!==null,'(a) link() still refuses a DERIVED frontier',derivedLinkErr??'accepted');
  // Could an owned exposable location be added AFTER construction?
  const canAddLate = typeof tree.addLocation==='function' || typeof tree.$.define==='function';
  check(!canAddLate,
    '(a) no API adds an owned location after construction, so a per-fact shadow location would have to be PERMANENT -- which L19 forbids',
    `addLocation=${typeof tree.addLocation} define=${typeof tree.$.define}`);
  tree.destroy();
}

// ---- (c) the contribution-store STATE MODEL behind an F5-style gate.
// Link observes the ORDINARY location. A gate consults the two frontiers.
{
  const n=K.getPathNotifier();
  const facts=new Map(); const live=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const turnOpen=new Map();
  const blocked=c=>dirty(c)||(c.turn!==null&&turnOpen.get(c.turn)===true);
  const contribute=(k,v,{owner=null,obligations=[],turn=null}={})=>{
    const f=F(k); f.contribs.push({v,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
    if(turn!==null&&!turnOpen.has(turn)) turnOpen.set(turn,true); compact(); };
  const compact=()=>{ for(const f of facts.values()){ let cut=-1;
    for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i]; if(c.settled&&!blocked(c)){cut=i;break;} }
    if(cut>=0){ f.base=f.contribs[cut].v; f.contribs=f.contribs.slice(cut+1); } } };
  const exposable=k=>{ const f=F(k);
    for(let i=f.contribs.length-1;i>=0;i--) if(!blocked(f.contribs[i])) return f.contribs[i].v;
    return f.base; };
  const settleTurn=t=>{ turnOpen.set(t,false);
    for(const f of facts.values()) for(const c of f.contribs) if(c.turn===t) c.settled=true; compact(); };
  const resolveOb=o=>{ live.delete(o); compact(); };

  const sentX=[],sentY=[];
  const tree=K.signalTree({x:0,y:0},{enhancers:[K.transactions()]});
  // F5-style gate: the consequence runs only when the fact is exposable.
  globalThis.__spikeEligible=undefined;
  const lx=K.link(tree.$.x,{set:v=>{ if(exposable('x')===v) sentX.push(v); }});
  const ly=K.link(tree.$.y,{set:v=>{ if(exposable('y')===v) sentY.push(v); }});
  await flush(n);
  sentX.length=0; sentY.length=0;

  live.add('O1');
  contribute('x',1,{owner:'P1',turn:'P1',obligations:['O1']});
  tree.$.x(1); await flush(n);
  contribute('y',7); tree.$.y(7); await flush(n);
  check(!sentX.includes(1),'(c) speculative x is withheld by the gate',`x=${JSON.stringify(sentX)}`);
  check(sentY.includes(7),'(c) independent y progresses',`y=${JSON.stringify(sentY)}`);

  settleTurn('P1'); resolveOb('O1');
  tree.$.x(tree.$.x()+0.0); tree.$.x(1); await flush(n);
  check(exposable('x')===1,'(c) x becomes exposable once the turn settles and O1 resolves',`exposable=${exposable('x')}`);
  lx.dispose(); ly.dispose(); tree.destroy();
}
writeFileSync(resolve(here,'wakeup-2-resolution.json'),JSON.stringify({probe:'WAKEUP-2',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
