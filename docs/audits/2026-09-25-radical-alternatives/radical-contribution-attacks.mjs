#!/usr/bin/env node
// Three cheap pure-model attacks on the contribution-store premise itself.
// Run BEFORE teaching it about entities: any one could expose a fundamental
// flaw, and the 10/10 result should make us attack harder, not be charitable.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store = () => {
  const facts=new Map(); const liveObligations=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>liveObligations.has(o));
  const api={
    openObligation:o=>liveObligations.add(o),
    resolveObligation(o){ liveObligations.delete(o); this.fold(); },
    contribute(k,value,{owner=null,obligations=[],turn=null}={}){
      const f=F(k); f.contribs.push({value,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
      this.fold(); return seq; },
    confirm(owner){ for(const f of facts.values()) for(const c of f.contribs) if(c.owner===owner) c.settled=true; this.fold(); },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].value:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!dirty(f.contribs[i])) return f.contribs[i].value;
      return f.base; },
    turnOfExposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!dirty(f.contribs[i])) return f.contribs[i].turn;
      return null; },
    fold(){ for(const f of facts.values()){
        while(f.contribs.length && f.contribs[0].settled && !dirty(f.contribs[0])){ f.base=f.contribs.shift().value; } } },
    depth(k){ return F(k).contribs.length; },
  };
  return api;
};

// ---- CHURN: settled writes behind ONE ancient unresolved contribution -------
{
  const s=store(); s.openObligation('O1');
  s.contribute('x',1,{owner:'P1',obligations:['O1']});     // never resolves
  const N=100000;
  for(let i=2;i<=N+1;i++) s.contribute('x',i);             // ordinary settled writes
  const depth=s.depth('x');
  check(s.visible('x')===N+1,'CHURN visible tracks the latest write',`visible=${s.visible('x')}`);
  check(depth<=10,
    'CHURN retained depth is O(live obligations), NOT O(writes)',
    `depth after ${N} settled writes behind one unresolved contribution = ${depth}`);
}

// ---- AUTHORITY: insertion order is not authority order ---------------------
{
  const s=store(); s.openObligation('O1');
  // Authoritative truth arrives FIRST, then a later authored pending write.
  s.contribute('x',3);                                      // server truth
  s.contribute('x',1,{owner:'P1',obligations:['O1']});       // authored, later in order
  check(s.exposable('x')===3,'AUTHORITY exposable ignores the unresolved authored contribution',
    `exposable=${s.exposable('x')}`);
  // L11: fresh authoritative truth must NOT settle an unrelated pending one.
  s.contribute('x',5);                                      // newer server truth
  const stillPending=s.exposable('x')===5 && s.visible('x')===5;
  check(stillPending,'AUTHORITY newer authoritative truth advances the frontier',
    `visible=${s.visible('x')} exposable=${s.exposable('x')}`);
  // The authored contribution is now BURIED beneath later settled truth. Does
  // the model still know it is unresolved and must not be silently dropped?
  const p1Alive=JSON.stringify(s).includes('P1') || s.depth('x')>0;
  check(p1Alive,'AUTHORITY the unresolved authored contribution is not silently lost under later truth',
    `depth=${s.depth('x')}`);
}

// ---- COHERENCE: can per-fact selection TEAR one causal turn? ---------------
{
  const s=store(); s.openObligation('OT');
  // ONE causal turn writes two facts. Only one of them carries the obligation.
  s.contribute('x',10,{owner:'T1',turn:'T1',obligations:['OT']});
  s.contribute('y',20,{owner:'T1',turn:'T1'});               // same turn, clean
  s.confirm('T1');
  const xe=s.exposable('x'), ye=s.exposable('y');
  const xt=s.turnOfExposable('x'), yt=s.turnOfExposable('y');
  check(!(xe===0 && ye===20),
    'COHERENCE per-fact selection must not expose HALF of one causal turn',
    `exposable x=${xe} (turn ${xt}) y=${ye} (turn ${yt}) -- {old x, new y} is a state that never existed`);
}

writeFileSync(resolve(here,'radical-contribution-attacks.json'),JSON.stringify({probe:'CONTRIBUTION-ATTACKS',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
