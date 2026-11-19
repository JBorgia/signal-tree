from pathlib import Path
p=Path(__file__).parent
old=Path('/private/tmp/st-point-residual-c8a-attribution/candidate/packages/kernel/src/lib/point-residual-attribution.spec.ts').read_text()
source=Path('/private/tmp/st-native-combined-c21/candidate/packages/kernel/src/lib/entity-granular-reactivity.spec.ts').read_text()
counter=source[source.index('function countIteratedElements('):source.index("\ndescribe('entityMap — collection queries",source.index('function countIteratedElements('))].strip()
attr=old[old.index('function attribute('):old.index('\nfor (const size',old.index('function attribute('))]
attr=attr.replace('point-residual-attribution.spec.ts','point-work-attribution.spec.ts').replace('  let visited = 0;','  let visited = 0;\n  const perWrite = new Array<number>(200).fill(0);',1).replace('entry.calls++;entry.visits+=n;visited+=n;','entry.calls++;entry.visits+=n;visited+=n;\n      if(writeIndex >= 0) perWrite[writeIndex]+=n;').replace('return {total:counted,events:Object.values(events)};','return {total:counted,perWrite,events:Object.values(events)};')
head="""import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {entityMap} from '../index';
import {signalTree} from './signal-tree';
let writeIndex=-1;
"""
tail="""
it('calibrates positive, empty, nested work and restores on throw',()=>{
 const map=new Map([[1,1],[2,2]]);
 const positive=()=>{Array.from(map.values());[1,2,3].map(x=>x+1);};
 expect(countIteratedElements(positive)).toBe(7);expect(attribute(positive).total).toBe(7);
 expect(attribute(()=>{}).total).toBe(0);
 const nested=()=>{[1,2].map(()=>[1,2,3].includes(3));};
 expect(countIteratedElements(nested)).toBe(8);expect(attribute(nested).total).toBe(8);
 const before=[Array.prototype.map,Array.prototype.filter,Array.prototype.push,Array.from,Map.prototype[Symbol.iterator],Object.keys];
 const sentinel=Object.freeze({error:'attribution calibration'});
 let caught:unknown;try{attribute(()=>{[1].map(()=>{throw sentinel;});});}catch(e){caught=e;}
 expect(caught).toBe(sentinel);
 expect([Array.prototype.map,Array.prototype.filter,Array.prototype.push,Array.from,Map.prototype[Symbol.iterator],Object.keys]).toEqual(before);
});
for(const size of [2000,20000])it(`exact C21 point visits rows=${size}`,()=>{
 function workload<T>(measure:(action:()=>void)=>T):T {
  const tree=signalTree({rows:entityMap<{id:number;v:number},number>({selectId:r=>r.id})});
  try{
   tree.$.rows.setAll(Array.from({length:size},(_,id)=>({id,v:0})));
   const result=measure(()=>{for(let i=0;i<200;i++){writeIndex=i;tree.$.rows.updateOne(i,{v:1});}});
   writeIndex=-1;
   for(let i=0;i<200;i++)expect(tree.$.rows.byId(i)?.().v).toBe(1);
   expect(tree.$.rows.byId(201)?.().v).toBe(0);
   return result;
  }finally{writeIndex=-1;tree.destroy();}
 }
 const original=workload(countIteratedElements),traced=workload(attribute);
 writeFileSync(`/private/tmp/st-c21-point-work-attribution/rows-${size}.json`,JSON.stringify({size,writes:200,width:2,original,...traced},null,2));
 expect(traced.total).toBe(original);
 expect(traced.events.reduce((n,e)=>n+e.visits,0)).toBe(original);
 expect(traced.perWrite.reduce((a,b)=>a+b,0)).toBe(original);
 expect(original).toBeGreaterThan(0);
});
"""
(p/'PROBE.spec.ts').write_text(head+counter+'\n\n'+attr+tail)
(p/'COUNTER-EXACT.txt').write_text(counter+'\n')
print('probe prepared from exact original counter')
