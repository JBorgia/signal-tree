import {expect,it} from 'vitest';
import {signalTree,entityMap} from '../index';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {getEntityPublicationBinding} from '../../../kernel/src/lib/internals/entity-publication';
it('direct source completion reads the installed row leaf and collection',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()});t.$.rows.addOne({id:1,n:0});const leaf=t.$.rows.byIdOrFail(1).n;expect(leaf.value).toBe(0);expect(t.$.rows.all.value).toEqual([{id:1,n:0}]);const seen:unknown[]=[];
 const stop=required(getEntityPublicationBinding(t.$.rows)).source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){seen.push([leaf.value,t.$.rows.byIdOrFail(1).n.value,t.$.rows.all.value]);}});
 try{t.$.rows.updateOne(1,{n:2});expect(seen.length).toBeGreaterThan(0);expect(seen.every(x=>JSON.stringify(x)===JSON.stringify([2,2,[{id:1,n:2}]]))).toBe(true);}finally{stop();t.destroy();}
});
for(const kind of ['replace','many','upsert','setAll','remove','clear'] as const)it(`direct ${kind} source completion sees coherent row and membership`,()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()});t.$.rows.addOne({id:1,n:0});const leaf=t.$.rows.byIdOrFail(1).n;expect(leaf.value).toBe(0);const seen:unknown[]=[];const removed=kind==='remove'||kind==='clear';
 const off=required(getEntityPublicationBinding(t.$.rows)).source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){seen.push([leaf.value,t.$.rows.all.value]);}});
 try{if(kind==='replace')t.$.rows.replaceOne(1,{id:1,n:2});else if(kind==='many')t.$.rows.updateMany([1],{n:2});else if(kind==='upsert')t.$.rows.upsertMany([{id:1,n:2}]);else if(kind==='setAll')t.$.rows.setAll([{id:1,n:2}]);else if(kind==='remove')t.$.rows.removeOne(1);else t.$.rows.clear();expect(seen.length).toBeGreaterThan(0);for(const snapshot of seen)expect(snapshot).toEqual(removed?[undefined,[]]:[2,[{id:1,n:2}]]);}finally{off();t.destroy();}
});
it('direct completion drains exact error and leaves installed native truth useful',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()});t.$.rows.addOne({id:1,n:0});const sentinel={tag:'complete'},calls:number[]=[];const source=required(getEntityPublicationBinding(t.$.rows)).source;
 const stops=[0,1].map(i=>source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){calls.push(i);if(i===0)throw sentinel;}}));
 try{let caught:unknown;try{t.$.rows.updateOne(1,{n:2});}catch(e){caught=e;}expect(caught).toBe(sentinel);expect(calls).toEqual([0,1]);expect(t.$.rows.byIdOrFail(1).n.value).toBe(2);expect(t.$.rows.all.value).toEqual([{id:1,n:2}]);}finally{for(const off of stops)off();t.destroy();}
});

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Fixture expected a present value");
  return value;
}
