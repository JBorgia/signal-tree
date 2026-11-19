from pathlib import Path
p=Path(__file__).resolve().parent
common='''import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
IMPORTS
import {restorationReader} from './internals/restoration-reader';
import {installProductionSubstrateStatsForTesting,resetProductionSubstrateStatsForTesting,clearProductionSubstrateStatsForTesting} from './internals/production-substrate-stats';
const drain=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const mode='MODE';
for(const n of [3,32])it(`restoration stats stages ${mode} N=${n}`,async()=>{
 async function run(traced:boolean){
  const tree=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[restoration()]});
  const oldLimit=Error.stackTraceLimit;Error.stackTraceLimit=40;
  try{
   tree.$.rows.setAll(Array.from({length:n},(_,id)=>({id,n:id})));await drain();
   undoable(()=>tree.$.rows.updateOne(0,{n:-1}));await drain();undoable(()=>tree.$.rows.clear());await drain();
   if(mode==='large-sequence'){expect(restorationReader(tree)?.snapshot().entries).toHaveLength(2);expect(tree.getCurrentIndex()).toBe(1);}
   const stats=installProductionSubstrateStatsForTesting();let value=0;let active=false;let events:Record<string,number>={};
   if(traced)Object.defineProperty(stats,'publicationDependencyReads',{configurable:true,enumerable:true,get:()=>value,set:(next:number)=>{const delta=next-value;value=next;if(active){const stack=new Error('count attribution').stack??'';events[stack]=(events[stack]??0)+delta;}}});
   const phases=[];
   try{
    active=true;tree.jumpTo(0);active=false;const undo={phase:'jumpTo0',reads:stats.publicationDependencyReads,writes:stats.valueStoreWrites,events};phases.push(undo);expect(undo.writes).toBe(n);
    const expected=Array.from({length:n},(_,id)=>({id,n:id===0?-1:id}));
    if(mode==='paired'){expect(tree.$.rows.all()).toEqual(expected);}else{const ids=tree.$.rows.ids();expect(ids.length).toBe(n);expect(ids[0]).toBe(0);expect(ids[n-1]).toBe(n-1);expect(tree.$.rows.byId(0)?.()?.n).toBe(-1);}
    resetProductionSubstrateStatsForTesting(stats);events={};active=true;tree.jumpTo(1);active=false;const redo={phase:'jumpTo1',reads:stats.publicationDependencyReads,tombstones:stats.structuralSubjectTombstones,events};phases.push(redo);expect(redo.tombstones).toBe(n);
    if(mode==='paired')expect(tree.$.rows.all()).toEqual([]);else expect(tree.$.rows.count()).toBe(0);
    return phases;
   }finally{active=false;clearProductionSubstrateStatsForTesting();}
  }finally{tree.destroy();Error.stackTraceLimit=oldLimit;}
 }
 const plain=await run(false),traced=await run(true);
 expect(traced.map(({events,...phase})=>phase)).toEqual(plain.map(({events,...phase})=>phase));
 for(const phase of traced)expect(Object.values(phase.events).reduce((a,b)=>a+b,0)).toBe(phase.reads);
 writeFileSync(process.env.ST_TRACE_OUTPUT+`/${mode}-${n}.json`,JSON.stringify({n,mode,plain,traced},null,2));
});
'''
imports={'paired':"import {entityMap,restoration,signalTree,undoable} from '../index';",'large-sequence':"import {signalTree} from './signal-tree';\nimport {entityMap} from './markers/entity-map';\nimport {undoable} from './undoable';\nimport {restoration} from '../enhancers/restoration/restoration';"}
for mode,imp in imports.items():(p/'candidate/packages/kernel/src/lib'/f'restoration-extra-{mode}.spec.ts').write_text(common.replace('IMPORTS',imp).replace('MODE',mode))
