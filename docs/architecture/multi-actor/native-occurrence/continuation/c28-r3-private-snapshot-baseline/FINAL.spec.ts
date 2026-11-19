import {appendFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {entityMap,link,restoration,undoable} from '../index';
import {createSignalTreeFactory} from './signal-tree';
import {createReactiveTestRealization,observeReactiveTestValue} from '../reactive-test-realization';
import {createLocationRuntime} from './internals/location-runtime';
import {getPositionRegistry} from './internals/position-registry';
import {openPhysicalRows,physicalRows,taps} from './internals/physical-rows';
import {createTreeRealizationAdapter,rememberTreeRealizationDescriptor,type TreeRealizationDescriptor} from './internals/causal-runtime/tree-realization-adapter';
import {getOwnedPositionIds} from './internals/owned-mutation';
import type {ISignalTree} from './types';
type Row={id:string;n:number;extra?:number};
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function record(name:string,value:unknown){const sink=process.env['ST_SNAPSHOT_OUTPUT'];if(!sink)throw Error('Required diagnostic sink');appendFileSync(sink,JSON.stringify({name,value})+'\n');}
function setup(){
 const native=createReactiveTestRealization();let phase='off';let nextToken=0;const reads:{phase:string;token:number;stack:string}[]=[];
 const observation={...native,createToken:()=>{const token=native.createToken(),id=++nextToken;return {observe:()=>{if(phase!=='off')reads.push({phase,token:id,stack:new Error().stack??''});token.observe();},invalidate:()=>token.invalidate()};}};
 const realization={...observation,locations:createLocationRuntime(observation)};const calls:{phase:string;method:string;stack:string}[]=[];
 const restorers:(()=>void)[]=[];
 const instrument=(locations:ReturnType<typeof createLocationRuntime>)=>{for(const method of ['createDerived','createWritableProjection'] as const){
  const original=locations[method];
  if(!original){record('factory-unavailable',method);continue;}
  const spy=vi.spyOn(locations,method).mockImplementation(function(...args:unknown[]){if(phase!=='off')calls.push({phase,method,stack:new Error().stack??''});return Reflect.apply(original,locations,args);});restorers.push(()=>spy.mockRestore());
 }
 return locations;};
 const make=createSignalTreeFactory(observation,undefined,bound=>instrument(createLocationRuntime(bound)));
 const tree=make({rows:entityMap<Row,string>(),stamp:0},{enhancers:[restoration()]});
 return {tree,make,realization,calls,setPhase:(p:string)=>{phase=p;},finish:(name:string)=>{record(name,{calls,reads});for(const f of restorers)f();tree.destroy();}};
}
const old:Row[]=[{id:'a',n:1},{id:'b',n:2}];
const replacement:Row[]=[{id:'c',n:3},{id:'d',n:4}];
describe('private snapshot baseline characterization',()=>{
 it('1 cold replacement exposes useful undo/redo and construction provenance',async()=>{
  const h=setup();const t=h.tree;let stop:ReturnType<typeof link>|undefined;
  try{t.$.rows.setAll(old);await flush();const sent:Row[][]=[];stop=link(t.$.rows,{set:v=>{sent.push(v.map(x=>({...x})));}});
   undoable(()=>t.$.rows.setAll(replacement));await flush();expect(t.$.rows.all()).toEqual(replacement);
   h.setPhase('replacement-undo');t.undo();h.setPhase('off');await flush();expect(t.$.rows.all()).toEqual(old);expect(sent.at(-1)).toEqual(old);
   h.setPhase('replacement-redo');t.redo();h.setPhase('off');await flush();expect(t.$.rows.all()).toEqual(replacement);expect(sent.at(-1)).toEqual(replacement);
   t.$.rows.updateOne('c',{n:8});await flush();expect(sent.at(-1)).toEqual([{id:'c',n:8},replacement[1]]);
   record('1-publication',sent);
  }finally{stop?.dispose();h.finish('1-factories');}
 });
 it('2 point reversal preserves held native field and tracks preparation reads',async()=>{
  const h=setup(),t=h.tree;
  try{t.$.rows.setAll(old);await flush();h.setPhase('calibration-cold');const held=t.$.rows.byIdOrFail('a');const field=held.n;h.setPhase('off');
   const observed:number[]=[];const read=observeReactiveTestValue(()=>field()!,v=>observed.push(v));
   undoable(()=>t.$.rows.updateOne('a',{n:7}));await flush();expect(read()).toBe(7);
   h.setPhase('point-undo');t.undo();h.setPhase('off');await flush();expect(read()).toBe(1);expect(held()).toEqual(old[0]);
   t.$.rows.updateOne('a',{n:9});await flush();expect(read()).toBe(9);expect(observed.at(-1)).toBe(9);expect(h.calls.some(x=>x.phase==='calibration-cold')).toBe(true);
   record('2-observed',observed);
  }finally{h.finish('2-factories');}
 });
 it('3 mixed point and removal keeps current lifetime and restored held row',async()=>{
  const h=setup(),t=h.tree;
  try{t.$.rows.setAll(old);await flush();const held=t.$.rows.byIdOrFail('b'),field=held.n;
   undoable(()=>{t.$.rows.updateOne('a',{n:7});t.$.rows.removeOne('b');});await flush();expect(t.$.rows.all()).toEqual([{id:'a',n:7}]);expect(held()).toBeUndefined();
   h.setPhase('mixed-undo');t.undo();h.setPhase('off');await flush();expect(t.$.rows.all()).toEqual(old);expect(field()).toBe(2);
   t.$.rows.changeId('b','z');t.$.rows.addOne({id:'b',n:6});expect(held()).toEqual(old[1]);expect(t.$.rows.byIdOrFail('b')()).toEqual({id:'b',n:6});t.$.rows.updateOne('z',{n:8});expect(field()).toBe(8);
  }finally{h.finish('3-factories');}
 });
 it('4 private physical-window ingress preserves tree and tap-depth absence',async()=>{
  const h=setup(),t=h.tree,other=h.make({rows:entityMap<Row,string>()});
  try{t.$.rows.setAll(old);other.$.rows.setAll([{id:'a',n:99}]);await flush();
   (t.$ as unknown as (v:object)=>void)({stamp:0});(other.$ as unknown as (v:object)=>void)({});
   expect(t.$.rows.byId('a')).toBeUndefined();expect(other.$.rows.byId('a')).toBeUndefined();
   const registry=getPositionRegistry(t.$)!;expect(registry).toBeDefined();openPhysicalRows(registry);
   try{expect(t.$.rows.byIdOrFail('a')()).toEqual(old[0]);expect(other.$.rows.byId('a')).toBeUndefined();taps.depth++;
    try{expect(t.$.rows.byId('a')).toBeUndefined();expect(t.$.rows.count()).toBe(0);}finally{taps.depth--;}
   }finally{physicalRows.pop();}
   expect(t.$.rows.byId('a')).toBeUndefined();expect(t.$.rows.all()).toEqual([]);
   record('4-scope','private window ingress; public absence assertions; not public hidden reversal proof');
  }finally{other.destroy();h.finish('4-factories');}
 });
 it('5 point clone callback failure is characterized without fixed getter oracle',async()=>{
  const h=setup(),t=h.tree;let reads=0;const sentinel=new Error('snapshot getter sentinel');
  try{t.$.rows.setAll([{id:'a',n:1,extra:2}]);await flush();undoable(()=>t.$.rows.updateOne('a',{n:7}));await flush();
   const current=t.$.rows.byIdOrFail('a')()!;Object.defineProperty(current,'extra',{get(){reads++;if(reads===1)t.$.stamp(5);throw sentinel;},enumerable:true,configurable:true});
   let failure:unknown;h.setPhase('clone-undo');try{t.undo();}catch(e){failure=e;}finally{h.setPhase('off');}
   record('5-clone',{reads,failure:failure instanceof Error?failure.message:String(failure),n:t.$.rows.byIdOrFail('a').n()});
   // Prior baseline reached the throwing getter and refused before installation; retain that oracle, with a genuine nested committed write now added.
   expect(failure).toBe(sentinel);expect(t.$.rows.byIdOrFail('a').n()).toBe(7);expect(t.$.stamp()).toBe(5);expect(reads).toBeGreaterThan(0);
   Object.defineProperty(t.$.rows.byIdOrFail('a')()!,'extra',{value:2,enumerable:true,configurable:true,writable:true});t.$.rows.updateOne('a',{n:9});expect(t.$.rows.byIdOrFail('a').n()).toBe(9);
  }finally{h.finish('5-factories');}
 });
 it('6 existing value-returning byIdOrFail shape keeps actual removal validation',async()=>{
  const h=setup(),t=h.tree;
  try{t.$.rows.setAll(old);await flush();const rows=t.$.rows;const original=rows.byIdOrFail;const value=original.call(rows,'a')()!;
   const internal=rows as unknown as {__acquireEntityHandleForTesting(k:string):{subjectId:number}};const subject=internal.__acquireEntityHandleForTesting('a').subjectId,owner=getOwnedPositionIds(rows)![0];
   const descriptors=new Map<number,TreeRealizationDescriptor>();rememberTreeRealizationDescriptor({descriptors,path:'rows.a',ownerPath:'rows',positionIds:[owner],subjectIds:[subject],meta:{structuralEffect:{kind:'remove',subject,key:'a',value}}});
   const adapter=createTreeRealizationAdapter({tree:t as unknown as ISignalTree<object>,descriptors});let calls=0;
   Object.defineProperty(rows,'byIdOrFail',{configurable:true,value:function(this:typeof rows,key:string){expect(this).toBe(rows);calls++;return original.call(rows,key)();}});
   try{expect(adapter.validateEffects([{owner,subjectId:subject,structural:'remove',before:'a',after:undefined}])).toBeUndefined();expect(calls).toBeGreaterThan(0);expect(rows.all()).toEqual(old);expect(rows.all()[0]).toBe(value);record('6-value-shape',{calls,sameValue:rows.all()[0]===value});}
   finally{Object.defineProperty(rows,'byIdOrFail',{configurable:true,value:original});}
  }finally{h.finish('6-factories');}
 });
});
