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
const sizes=(process.env['ST_ROOT_SIZES']??'1,2,4').split(',').map(Number);
for(const route of ['leaf','whole'] as const)for(const inheritedQ of [false,true])for(const connected of [true,false])it(`all declared roots ${route} q=${inheritedQ} connected=${connected}`,async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const other=signalTree({q:0},{enhancers:[transactions()]});const sent:unknown[]=[];
 let c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;let off=()=>{};
 try{
  const q=inheritedQ?other.transact(()=>other.$.q(1)):undefined;let p!:ReturnType<typeof t.transact>;
  if(q)c.declare({kind:'dependent',owners:[q]},()=>{p=t.transact(()=>t.$.pair.x(7));});else p=t.transact(()=>t.$.pair.x(7));
  await drain();expect(sent).toEqual([]);const source=t.$.pair.x;const snapshots=[t.$.pair()];let notices=0;off=source.subscribe(()=>notices++);
  const selected=__c25SourceRoots(source,snapshots).endpoint!;const requirement=selected.requirement;
  if(!connected)c.dispose();
  const sample=(n:number)=>{const roots=__c25SourceRoots(source,snapshots);expect(roots.endpoint).toBe(selected);expect(roots.endpoint!.requirement).toBe(requirement);
   const counts=graph([roots,__c25LifecycleRoots(),__c25ReadRoots(getPositionRegistry(source)!)]);
   const diag=diagnostics();const record={route,inheritedQ,connected,n,...counts,activeFrames:diag.activeFrames,operations:diag.operations,listeners:diag.listeners,latest:diag.latest};
   const output=process.env['ST_ROOT_OUTPUT'];if(!output)throw Error('Research output required');appendFileSync(output,JSON.stringify(record)+'\n');return record;};
  const before=sample(0);let completed=0;
  for(const n of sizes){for(;completed<n;completed++){
   if(!connected)c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;
   c.declare({kind:'independent'},()=>{if(!connected)c.dispose();if(route==='leaf')source(7);else t.$.pair({x:7,y:0});});
   await drain();
  }
   const after=sample(n);for(const key of ['objects','edges','requirements','roleEdges','frames','inputs','components','activeFrames','operations','listeners','latest'] as const)expect(after[key],key).toBeLessThanOrEqual(before[key]);
   expect(source()).toBe(7);expect(notices).toBe(0);expect(sent).toEqual([]);
  }
  if(!connected)c=link(t.$.pair,{set:v=>{sent.push(v);}}) as C;
  p.confirm();await drain();if(q){expect(sent).toEqual([]);q.confirm();await drain();}
  expect(sent).toEqual([{x:7,y:0}]);await c.settled();c.dispose();await drain();expect(diagnostics().activeFrames).toBe(0);
 }finally{off();c.dispose();t.destroy();other.destroy();}
});
