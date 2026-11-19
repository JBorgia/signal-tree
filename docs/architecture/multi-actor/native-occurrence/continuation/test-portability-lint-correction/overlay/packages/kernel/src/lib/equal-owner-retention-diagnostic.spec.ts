import { writeDiagnostic } from '../../test/optional-diagnostic';
import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import * as selection from './internals/native-scalar-selection';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {getPositionRegistry} from './internals/position-registry';
import * as life from './experimental-publication/lifecycle';
// Research-only private cast; never a shipping API assertion.
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'}|{kind:'dependent';owners:readonly unknown[]},work:()=>unknown):unknown};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
function structure(root:life.NativeRequirement){
 const unique=new Set<life.NativeRequirement>();let visits=0,edges=0,depth=0;
 const visit=(r:life.NativeRequirement,d:number)=>{visits++;unique.add(r);depth=Math.max(depth,d);for(const child of r.components??[]){edges++;visit(child,d+1);}};
 visit(root,0);return {nodes:unique.size,componentTraversalVisits:visits,edges,depth,owners:new Set(life.nativeProof(root).owners).size,ready:life.nativeRequirementReady(root)};
}
// One transparent wrapper shared by the observation and its forwarding witness.
function observeSelection(original:typeof selection.prepareScalarSelection,observe:(args:Parameters<typeof original>)=>void):typeof original {
 return (...args:Parameters<typeof original>)=>{observe(args);return original(...args);};
}
for(const route of ['leaf','whole'] as const)for(const n of [64,256])for(const inheritedQ of [false,true])it(`fixed obligation retention ${route} ${n} q=${inheritedQ}`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;const node=t.$.pair.x;let captured:life.NativeRequirement|undefined;let notices=0;
 const original=selection.prepareScalarSelection;
 const spy=vi.spyOn(selection,'prepareScalarSelection').mockImplementation(observeSelection(original,args=>{
  const [registry,source,,before]=args;
  if(registry===getPositionRegistry(node)&&getOwnedPositionIds(source)?.[0]===getOwnedPositionIds(node)?.[0])captured=before.requirement as life.NativeRequirement;
 }));
 let off=()=>{ /* The retention fixture observes ownership separately from this callback. */ };
 try{
  const q=inheritedQ?other.transact(()=>other.$.q(1)):undefined;let p!:ReturnType<typeof t.transact>;
  if(q)c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>node(7));});else p=t.transact(()=>node(7));
  await drain();expect(sent).toEqual([]);off=node.subscribe(()=>notices++);
  const equal=()=>c.declare({kind:'independent'},()=>route==='leaf'?node(7):t.$.pair({x:7,y:0}));
  for(let i=0;i<n;i++)equal();await drain();
  // Probe captures the source BEFORE one further equal declaration; no receipt is retained.
  captured=undefined;equal();if(!captured)throw Error('Source selection probe did not run');
  const counts=structure(captured);const output=process.env['ST_EQUAL_OWNER_TRACE'];writeDiagnostic(output,JSON.stringify({route,n,inheritedQ,captured:'before extra probe declaration',...counts})+'\n',true);
  expect(counts.owners).toBe(inheritedQ?2:1);expect(counts.ready).toBe(true);expect(node()).toBe(7);expect(notices).toBe(0);expect(sent).toEqual([]);
  p.confirm();await drain();if(q){expect(sent).toEqual([]);q.confirm();await drain();}
  expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{spy.mockRestore();off();c.dispose();t.destroy();other.destroy();}
});
it('selection observation forwards exact true false and omitted optional arguments',()=>{
 const registry={},node={},before={present:true,value:0,requirement:life.initialRequirement()},proposed={present:true,value:1,requirement:life.initialRequirement()};
 const mutation={intent:'replace',before:0,after:1,changed:true} as const;
 const result={endpoint:proposed};const sentinel=new Error('selection witness');let fail=false;
 const seen:Parameters<typeof selection.prepareScalarSelection>[]=[];const forwarded:boolean[]=[];
 const release=selection.registerScalarSelection(registry,(actualNode,actualMutation,actualBefore,actualProposed,allow)=>{
  expect(actualNode).toBe(node);expect(actualMutation).toBe(mutation);expect(actualBefore).toBe(before);expect(actualProposed).toBe(proposed);forwarded.push(allow);
  if(fail)throw sentinel;return result;
 });
 const original=selection.prepareScalarSelection;
 const spy=vi.spyOn(selection,'prepareScalarSelection').mockImplementation(observeSelection(original,args=>{seen.push(args);}));
 try{
  expect(selection.prepareScalarSelection(registry,node,mutation,before,proposed,true)).toBe(result);
  expect(selection.prepareScalarSelection(registry,node,mutation,before,proposed,false)).toBe(result);
  expect(selection.prepareScalarSelection(registry,node,mutation,before,proposed)).toBe(result);
  expect(seen.map(args=>args.length)).toEqual([6,6,5]);expect(seen.map(args=>args[5])).toEqual([true,false,undefined]);expect(forwarded).toEqual([true,false,false]);
  fail=true;let caught:unknown;try{selection.prepareScalarSelection(registry,node,mutation,before,proposed,true);}catch(error){caught=error;}expect(caught).toBe(sentinel);
 }finally{spy.mockRestore();release();}
});
