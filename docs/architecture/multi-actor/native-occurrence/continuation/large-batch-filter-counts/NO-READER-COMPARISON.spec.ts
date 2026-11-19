import { afterAll, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { signalTree } from './signal-tree';
import { entityMap } from './markers/entity-map';
import { entityMembershipReader } from './internals/entity-membership-view';
type Site = { calls: number; visits: number; stack: string };
type Count = { totalCalls: number; totalVisits: number; sites: Record<string, Site> };
const output: unknown[] = [];
const nativeFilter = Array.prototype.filter;
function measured(action: () => void): Count {
  const sites = new Map<string, Site>();
  let collecting = false;
  Array.prototype.filter = function<T>(this: T[], predicate: (v:T,i:number,a:T[])=>unknown, thisArg?: unknown): T[] {
    if (collecting || typeof predicate !== 'function') return Reflect.apply(nativeFilter, this, [predicate, thisArg]);
    let stack = '', key = 'unclassified';
    collecting = true;
    try {
      stack = new Error('filter callsite').stack ?? '';
      for (const line of stack.split('\n')) {
        if (line.includes('/packages/kernel/src/') && !line.includes('large-batch-filter-count-probe.spec.ts')) { key = line.trim(); break; }
      }
    } finally { collecting = false; }
    let site = sites.get(key);
    if (!site) { site = { calls: 0, visits: 0, stack }; sites.set(key, site); }
    site.calls++;
    return Reflect.apply(nativeFilter, this, [function(value:T,index:number,array:T[]) {
      site.visits++;
      return Reflect.apply(predicate, thisArg, [value,index,array]);
    }]);
  };
  try { action(); } finally { Array.prototype.filter = nativeFilter; }
  let totalCalls=0,totalVisits=0;
  for(const site of sites.values()){totalCalls+=site.calls;totalVisits+=site.visits;}
  return {totalCalls,totalVisits,sites:Object.fromEntries(sites)};
}
afterAll(()=>writeFileSync(process.env.TMPDIR+'/filter-counts.json',JSON.stringify(output,null,2)));
it('native filter parity and restoration calibration',()=>{
  const exercise=()=>{const a=[1,,3,4],context={min:2};const seen:unknown[]=[];const result=a.filter(function(this:typeof context,v,i,array){seen.push([v,i,array===a,this===context]);if(i===0){a[2]=5;delete a[3];a.push(9);}return v>this.min;},context);return {result,seen};};
  const plain=exercise();let actual:ReturnType<typeof exercise>|undefined;const count=measured(()=>{actual=exercise();});expect(actual).toEqual(plain);expect(count.totalVisits).toBe(2);expect(Array.prototype.filter).toBe(nativeFilter);
  const sentinel={failure:'predicate'};let caught:unknown;try{measured(()=>{[1].filter(()=>{throw sentinel;});});}catch(error){caught=error;}expect(caught).toBe(sentinel);expect(Array.prototype.filter).toBe(nativeFilter);
  let species=0;class Derived extends Array<number>{static get [Symbol.species](){species++;return Array;}}
  let result:number[]=[];measured(()=>{result=new Derived(1,2,3).filter(v=>v>1);});expect(result).toEqual([2,3]);expect(Object.getPrototypeOf(result)).toBe(Array.prototype);expect(species).toBe(1);
});
for(const n of [16,32,64,128])for(const observed of [false,true])it(`filter visits N=${n} membership=${observed}`,()=>{
  function run(instrumented:boolean){
    const tree=signalTree({rows:entityMap<{id:number;n:number},number>()});
    const reader=observed?entityMembershipReader(tree):undefined;if(observed)expect(reader).toBeDefined();let events=0;
    const stop=observed?reader!.subscribe(()=>{events++;}):()=>{/* No subscription. */};
    const initial=Array.from({length:n},(_,i)=>({id:i,n:i})),replacement=Array.from({length:n},(_,i)=>({id:i+n,n:i}));
    const stages:unknown[]=[];const states:unknown[]=[];
    try{
      const inputs=[initial,replacement,[]],labels=['setAll-initial','setAll-disjoint-replace','setAll-empty-clear'];
      for(let i=0;i<3;i++){
        const beforeEvents=events;const action=()=>tree.$.rows.setAll(inputs[i]);
        const counts=instrumented?measured(action):undefined;if(!instrumented)action();
        const state={count:tree.$.rows.count(),ids:tree.$.rows.ids(),events:events-beforeEvents};
        expect(state.count).toBe(inputs[i].length);expect(state.ids).toEqual(inputs[i].map(r=>r.id));states.push(state);stages.push({stage:labels[i],...counts,events:state.events});
        expect(Array.prototype.filter).toBe(nativeFilter);
      }
      expect(tree.$.rows.count()).toBe(0);if(observed)expect(events).toBeGreaterThan(0);else expect(events).toBe(0);
      return {states,stages,events};
    }finally{stop();tree.destroy();}
  }
  const plain=run(false),counted=run(true);expect(counted.states).toEqual(plain.states);expect(counted.events).toBe(plain.events);output.push({n,observed,parity:true,actualFinalCount:0,events:counted.events,stages:counted.stages});
});
