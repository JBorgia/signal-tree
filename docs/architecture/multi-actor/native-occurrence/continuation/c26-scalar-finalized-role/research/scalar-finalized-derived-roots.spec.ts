import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {__c25SourceRoots,__c25FactRoot,diagnostics} from './experimental-publication/private';
import {__c25LifecycleRoots,__c25LifecycleWeakRoots,nativeProof,type NativeRequirement} from './experimental-publication/lifecycle';
import {__c25ReadRoots} from './internals/native-scalar-selection';
import {getPositionRegistry} from './internals/position-registry';
type C=ReturnType<typeof link>&{declare(input:unknown,work:()=>unknown):unknown};
const drain=async()=>{for(let i=0;i<120;i++)await Promise.resolve();};
function graph(roots:unknown[]){
 const seen=new Set<object>(),requirements=new Set<object>();let edges=0,roleEdges=0,frames=0,inputs=0,components=0;
 const visit=(v:unknown)=>{if(!v||typeof v!=='object'&&typeof v!=='function'||seen.has(v))return;seen.add(v);
  if(v instanceof Map){for(const [k,x]of v){edges+=2;visit(k);visit(x);}return;}if(v instanceof Set){for(const x of v){edges++;visit(x);}return;}
  if(Object.hasOwn(v,'known')&&Object.hasOwn(v,'frames')&&Object.hasOwn(v,'inputs')){requirements.add(v);const req=v as NativeRequirement;frames+=req.frames.length;inputs+=req.inputs.length;components+=req.components?.length??0;roleEdges+=Object.values(nativeProof(req)).reduce<number>((n,x)=>n+(Array.isArray(x)?x.length:0),0);}
  for(const key of Reflect.ownKeys(v)){if(typeof v==='function'&&['caller','callee','arguments','prototype','length','name'].includes(String(key)))continue;const d=Object.getOwnPropertyDescriptor(v,key);if(d&&'value'in d){edges++;visit(d.value);}}
  visit(__c25FactRoot(v));for(const x of __c25LifecycleWeakRoots(v))visit(x);
 };
 roots.forEach(visit);return {objects:seen.size,edges,requirements:requirements.size,roleEdges,frames,inputs,components};
}
it('fixed p+q derived closed invocations: bounded diagnostic 1/2/4 only',async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;let off=()=>{};
 try{
  const q=other.transact(()=>other.$.q(1));let p!:ReturnType<typeof t.transact>;
  c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>t.$.pair.x(7));});await drain();
  const source=t.$.pair.x,snapshots=[t.$.pair()];let calls=0,notices=0;off=source.subscribe(()=>notices++);
  const selected=__c25SourceRoots(source,snapshots).endpoint!;
  const componentGraph=(root:NativeRequirement)=>{const seen=new Set<NativeRequirement>();let depth=0,visits=0;const visit=(v:NativeRequirement,d:number)=>{visits++;seen.add(v);depth=Math.max(depth,d);for(const child of v.components??[])visit(child,d+1);};visit(root,0);return {nodes:seen.size,depth,visits};};
  const sample=(n:number)=>{const roots=__c25SourceRoots(source,snapshots),endpoint=roots.endpoint!;const requirement=endpoint.requirement as NativeRequirement;
   const output=process.env['ST_ROOT_OUTPUT'];if(!output)throw Error('Research output required');
   appendFileSync(output,JSON.stringify({n,endpointSame: endpoint===selected,requirementSame:endpoint.requirement===selected.requirement,source:componentGraph(requirement),allRoots:graph([roots,__c25LifecycleRoots(),__c25ReadRoots(getPositionRegistry(source)!)]),owners:new Set(nativeProof(requirement).owners).size,...diagnostics()})+'\n');
   expect(new Set(nativeProof(requirement).owners).size).toBe(2);expect(requirement.components).toBeUndefined();expect(Object.getOwnPropertyDescriptor(requirement,'proof')?.get).toBeUndefined();};
  sample(0);let completed=0;
  for(const n of [1,2,4]){for(;completed<n;completed++){c.declare({kind:'dependent',owners:[p,q]},()=>t.$.pair(current=>{calls++;return {...current};}));await drain();}
   sample(n);expect(calls).toBe(n);expect(notices).toBe(0);expect(t.$.pair()).toEqual({x:7,y:0});expect(sent).toEqual([]);expect(diagnostics().activeFrames).toBe(0);
  }
  p.confirm();await drain();expect(sent).toEqual([]);q.confirm();await drain();expect(sent).toEqual([{x:7,y:0}]);await c.settled();
 }finally{off();c.dispose();t.destroy();other.destroy();}
});

it('installed scalar closes with no recipient after disposal in open horizon',async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});
 const c=link(t.$.pair,{set:()=>{throw Error('premature send');}}) as C;
 let captured!:NativeRequirement;
 try{
  const q=other.transact(()=>other.$.q(1));let p!:ReturnType<typeof t.transact>;
  c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>t.$.pair.x(7));});await drain();
  c.declare({kind:'dependent',owners:[p,q]},()=>{
   t.$.pair(current=>({...current}));captured=__c25SourceRoots(t.$.pair.x,[]).endpoint!.requirement as NativeRequirement;
   expect(captured.components).toBeDefined();c.dispose();
  });
  expect(captured.components).toBeUndefined();expect(Object.getOwnPropertyDescriptor(captured,'proof')?.get).toBeUndefined();
  expect(__c25SourceRoots(t.$.pair.x,[]).endpoint!.requirement).toBe(captured);
  expect(new Set(nativeProof(captured).owners).size).toBe(2);expect(t.$.pair()).toEqual({x:7,y:0});
  p.confirm();q.confirm();await drain();
 }finally{c.dispose();t.destroy();other.destroy();}
});
