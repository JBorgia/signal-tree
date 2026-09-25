#!/usr/bin/env node
// RADICAL-CONTRIBUTION-COHERENCE-1
//
// Repair the torn-turn failure WITHOUT recreating today's bug. The rule must
// deliver BOTH:
//
//     atomicity WITHIN demonstrated causal membership
//     independence ACROSS unrelated turns
//
// A rule of "any unresolved turn blocks the whole source" would pass the first
// and reproduce the tree-wide hold F5 measured. Kill if the repair needs a
// second snapshot or tree.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store=()=>{
  const facts=new Map(); const live=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  const api={
    open:o=>live.add(o),
    resolveObligation(o){ live.delete(o); this.compact(); },
    contribute(k,v,{owner=null,obligations=[],turn=null}={}){
      const f=F(k); f.contribs.push({v,order:++seq,owner,turn,settled:owner===null,obligations:new Set(obligations)});
      this.compact(); return seq; },
    confirm(o){ for(const f of facts.values()) for(const c of f.contribs) if(c.owner===o) c.settled=true; this.compact(); },
    /** A turn is clean only if EVERY still-live contribution of that turn is clean. */
    turnClean(t){ for(const f of facts.values()) for(const c of f.contribs) if(c.turn===t && dirty(c)) return false; return true; },
    compact(){ for(const f of facts.values()){ let cut=-1;
        for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i];
          if(c.settled && !dirty(c) && (c.turn===null || api.turnClean(c.turn))){ cut=i; break; } }
        if(cut>=0){ f.base=f.contribs[cut].v; f.contribs=f.contribs.slice(cut+1); } } },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].v:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i];
        if(!dirty(c) && (c.turn===null || api.turnClean(c.turn))) return c.v; }
      return f.base; },
    retained(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
  };
  return api;
};

// ARM 1 — atomicity WITHIN one causal turn.
{
  const s=store(); s.open('OT');
  s.contribute('x',10,{owner:'T1',turn:'T1',obligations:['OT']});
  s.contribute('y',20,{owner:'T1',turn:'T1'});          // same turn, individually clean
  s.confirm('T1');
  check(s.exposable('x')===0 && s.exposable('y')===0,
    'ARM1 one causal turn cannot be torn: neither half is exposable',
    `x=${s.exposable('x')} y=${s.exposable('y')}`);
  s.resolveObligation('OT');
  check(s.exposable('x')===10 && s.exposable('y')===20,
    'ARM1 the whole turn becomes exposable together',`x=${s.exposable('x')} y=${s.exposable('y')}`);
}
// ARM 2 — independence ACROSS unrelated turns. This is the anti-regression
// control: it must NOT reproduce the tree-wide hold.
{
  const s=store(); s.open('O1');
  s.contribute('x',1,{owner:'T1',turn:'T1',obligations:['O1']});
  s.contribute('y',20,{owner:'T2',turn:'T2'}); s.confirm('T2');
  check(s.exposable('y')===20,
    'ARM2 an UNRELATED turn still progresses while T1 is unresolved',`y=${s.exposable('y')}`);
  check(s.exposable('x')===0,'ARM2 ...and the unresolved turn is still withheld',`x=${s.exposable('x')}`);
}
// ARM 3 — a plain write outside any turn is never grouped.
{
  const s=store(); s.open('O1');
  s.contribute('a',1,{owner:'T1',turn:'T1',obligations:['O1']});
  s.contribute('b',2);
  check(s.exposable('b')===2,'ARM3 an ordinary write outside a turn is unaffected',`b=${s.exposable('b')}`);
}
// ARM 4 — partial dirt inside a LARGE turn must not block unrelated turns,
// and the blocked turn must not be split.
{
  const s=store(); s.open('OBIG');
  for(const k of ['p','q','r']) s.contribute(k,1,{owner:'TB',turn:'TB'});
  s.contribute('s',9,{owner:'TB',turn:'TB',obligations:['OBIG']});   // one dirty member
  s.confirm('TB');
  s.contribute('u',5); // unrelated plain write
  const blocked=['p','q','r','s'].every(k=>s.exposable(k)===0);
  check(blocked,'ARM4 ONE dirty member withholds the ENTIRE turn, not just itself',
    `p=${s.exposable('p')} q=${s.exposable('q')} r=${s.exposable('r')} s=${s.exposable('s')}`);
  check(s.exposable('u')===5,'ARM4 ...while unrelated work is untouched',`u=${s.exposable('u')}`);
}
// ARM 5 — NO SECOND SNAPSHOT. Coherence must cost only turn membership.
{
  const s=store(); s.open('OT');
  s.contribute('x',10,{owner:'T1',turn:'T1',obligations:['OT']});
  s.contribute('y',20,{owner:'T1',turn:'T1'});
  s.confirm('T1');
  check(s.retained()===2,
    'ARM5 coherence costs only the live contributions themselves -- no second snapshot or tree',
    `retained=${s.retained()} (one per still-unexposable fact)`);
  s.resolveObligation('OT');
  check(s.retained()===0,'ARM5 and they compact away once the turn is clean',`retained=${s.retained()}`);
}

writeFileSync(resolve(here,'radical-coherence-1.json'),JSON.stringify({probe:'COHERENCE-1',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
