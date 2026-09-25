#!/usr/bin/env node
// RADICAL-CONTRIBUTION-COMPACTION-1
//
// Is contribution-store fundamentally a LIVE-STATE model, or does it inevitably
// degenerate into retained history?
//
// The falsifier is not "does compaction bound depth" -- RC-1 already showed it
// does. It is whether compaction can be done WITHOUT secretly retaining
// predecessor history that rollback, authority or dependency needs later. If
// the repair becomes stack + predecessor chain + compaction journal +
// restoration metadata, contribution-store has recreated the problem it was
// meant to delete.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const checks=[]; const check=(ok,l,d)=>{checks.push({label:l,ok,detail:d});console.log(`${ok?'PASS':'FAIL'}  ${l}${d?`  -- ${d}`:''}`);};

const store=()=>{
  const facts=new Map(); const live=new Set(); let seq=0;
  const F=k=>{ if(!facts.has(k)) facts.set(k,{base:0,contribs:[]}); return facts.get(k); };
  const dirty=c=>[...c.obligations].some(o=>live.has(o));
  return {
    open:o=>live.add(o),
    resolveObligation(o){ live.delete(o); this.compact(); },
    contribute(k,v,{owner=null,obligations=[],authority=0}={}){
      const f=F(k); f.contribs.push({v,order:++seq,owner,authority,settled:owner===null,obligations:new Set(obligations)});
      this.compact(); return seq; },
    confirm(o){ for(const f of facts.values()) for(const c of f.contribs) if(c.owner===o) c.settled=true; this.compact(); },
    rollback(o){ for(const f of facts.values()) f.contribs=f.contribs.filter(c=>c.owner!==o); this.compact(); },
    compact(){ for(const f of facts.values()){ let cut=-1;
        for(let i=f.contribs.length-1;i>=0;i--){ const c=f.contribs[i]; if(c.settled&&!dirty(c)){ cut=i; break; } }
        if(cut>=0){ f.base=f.contribs[cut].v; f.contribs=f.contribs.slice(cut+1); } } },
    visible(k){ const f=F(k); return f.contribs.length?f.contribs[f.contribs.length-1].v:f.base; },
    exposable(k){ const f=F(k);
      for(let i=f.contribs.length-1;i>=0;i--) if(!dirty(f.contribs[i])) return f.contribs[i].v;
      return f.base; },
    /** Total retained per-contribution objects across every fact. */
    retained(){ let t=0; for(const f of facts.values()) t+=f.contribs.length; return t; },
    liveObligations(){ return live.size; },
    /** Full serialized state, to detect ANY hidden predecessor history. */
    dump(){ return JSON.stringify([...facts].map(([k,f])=>[k,f.base,f.contribs.map(c=>c.v)])); },
  };
};

const N=100000;
const s=store(); s.open('O1');
s.contribute('x',1,{owner:'P1',obligations:['O1']});
for(let i=2;i<=N+1;i++) s.contribute('x',i);

check(s.visible('x')===N+1,'visible(x) = 100001',`visible=${s.visible('x')}`);
check(s.exposable('x')===N+1,'exposable(x) = 100001 (the later writes are independent and safe)',
  `exposable=${s.exposable('x')}`);
check(s.retained()===0,'retained state is O(live obligations), NOT O(writes)',
  `retained contribution objects after ${N} writes = ${s.retained()}`);
check(s.liveObligations()===1,'the obligation itself stays live after its contribution is compacted away',
  `live=${s.liveObligations()}`);

// NO HIDDEN HISTORY: the entire serialized state must not contain the
// superseded values. If any predecessor chain survives, this string shows it.
const dumped=s.dump();
const leaks=[1,2,3,500,99999].filter(v=>JSON.parse(dumped)[0][2].includes(v));
check(dumped.length<200 && leaks.length===0,
  'NO HIDDEN HISTORY: the full serialized state retains no predecessor values',
  `size=${dumped.length} chars, leaked=${JSON.stringify(leaks)}, dump=${dumped.slice(0,90)}`);

// Rollback of the compacted-away unresolved contribution.
s.rollback('P1');
check(s.visible('x')===N+1,'after rollback of the compacted contribution, x remains 100001',
  `visible=${s.visible('x')}`);

// Authority arriving AFTER compaction must still win correctly.
s.contribute('x',7,{authority:5});
check(s.visible('x')===7 && s.exposable('x')===7,
  'authoritative truth arriving after compaction still wins',
  `visible=${s.visible('x')} exposable=${s.exposable('x')}`);

// DEPENDENCY SURVIVAL: a fact that inherited O1 must still be blocked even
// though P1's own contribution was compacted out of existence.
{
  const d=store(); d.open('O9');
  d.contribute('a',1,{owner:'PA',obligations:['O9']});
  for(let i=2;i<=5000;i++) d.contribute('a',i);          // compact PA away
  d.contribute('b',42,{owner:'PB',obligations:['O9']}); d.confirm('PB');
  check(d.retained()>0 && d.exposable('b')===0,
    'DEPENDENCY a dependent fact stays blocked though the ROOT contribution was compacted away',
    `retained=${d.retained()} exposable(b)=${d.exposable('b')}`);
  d.resolveObligation('O9');
  check(d.exposable('b')===42,'...and resolving the obligation releases it',`exposable(b)=${d.exposable('b')}`);
}

writeFileSync(resolve(here,'radical-compaction-1.json'),JSON.stringify({probe:'COMPACTION-1',checks},null,2)+'\n');
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} checks passed`);
process.exit(failed.length?1:0);
