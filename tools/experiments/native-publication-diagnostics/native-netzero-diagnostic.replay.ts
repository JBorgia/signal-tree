import {appendFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,link,signalTree,transactions} from '../../../packages/kernel/src/index';
import {getPathNotifier} from '../../../packages/kernel/src/lib/path-notifier';
import {getMutationCaptureRuntime} from '../../../packages/kernel/src/lib/internals/mutation-capture-runtime';
import {getEntityPublicationBinding} from '../../../packages/kernel/src/lib/internals/entity-publication';
import * as life from '../../../packages/kernel/src/lib/experimental-publication/lifecycle';
type Experimental=ReturnType<typeof link>&{declare(input:{kind:'independent'},work:()=>unknown):{read():unknown}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
const clone=(v:unknown):unknown=>v===undefined?null:JSON.parse(JSON.stringify(v));
for(const observe of [false,true])for(const route of ['collection','root'] as const)for(const mode of ['netzero','changed-twice','later-confirmed'] as const)it(`${mode}/${route}/observe=${observe}`,async()=>{
 const tree=signalTree({branch:{rows:entityMap<{id:string;x:number},string>()},other:0},{enhancers:[transactions()]});const rows=tree.$.branch.rows;
 rows.addOne({id:'a',x:0});await flush();const row=rows.byIdOrFail('a');
 const source=getEntityPublicationBinding(rows)!.source;const subject=getEntityPublicationBinding(row)!.subject!;
 const sent:unknown[]=[];const c=(route==='collection'?link(rows,{set:v=>{sent.push(v);}}):link<() => ReturnType<typeof tree.$>>(tree.$,{set:v=>{sent.push(v);}})) as Experimental;
 const runtime=getMutationCaptureRuntime(tree)!;const original=runtime.prepareEntityResponsibility;let phase='q';
 const captures:unknown[]=[];const packets:unknown[]=[];
 if(observe)runtime.prepareEntityResponsibility=capture=>{const plan=original?.(capture);captures.push({phase,changes:clone(capture.changes),participation:capture.meta?.participation,origin:capture.meta?.origin,plan:plan?{writes:plan.writes.length,adds:plan.adds.length}:null});return plan;};
 const off=observe?source.subscribe({prepare(packet){packets.push({phase,physical:clone(packet.physical),ordinary:clone(packet.ordinary),steps:clone(packet.steps),participation:packet.meta?.participation,origin:packet.meta?.origin});return undefined;},complete(){}}):()=>{};
 const names=new Map<life.OwnerCell,string>();const requirements=new WeakMap<object,number>();let reqSerial=0;
 const proof=(view:'physical'|'ordinary')=>{const ref=source.evidence()!.field(subject,'x',view) as life.NativeRequirement;let id=requirements.get(ref);if(!id)requirements.set(ref,id=++reqSerial);const p=life.nativeProof(ref);return {requirement:id,ready:life.nativeRequirementReady(ref),unknown:p.unknown,invalid:p.invalid,terminalRejectedRoles:p.terminalRejectedRoles??0,historicalWindow:p.historicalWindow??false,unavailableInput:p.unavailableInput??false,...Object.fromEntries((['owners','destination','input','validation','possible'] as const).map(role=>[role,(p[role]??[]).map(cell=>({name:names.get(cell)??'other',outcome:cell.outcome}))]))};};
 const existing=new Set(life.pendingOwners());const q=tree.transact(()=>rows.updateOne('a',{x:7}));for(const cell of life.pendingOwners())if(!existing.has(cell))names.set(cell,'q');
 let r:typeof q|undefined;let qRejected=false,rRejected=false;let receipt:ReturnType<Experimental['declare']>|undefined;const stages:unknown[]=[];
 const snapshot=(error?:unknown)=>{stages.push({phase,value:row.x(),q:clone(q.inspect()),r:r?clone(r.inspect()):null,proof:{ordinary:proof('ordinary'),physical:proof('physical')},receipt:receipt?clone(receipt.read()):null,sent:clone(sent),error:error instanceof Error?{name:error.name,message:error.message}:error??null});};
 try{
  await flush();expect(row.x()).toBe(7);expect(sent).toEqual([]);snapshot();phase='write';
  const old=new Set(life.pendingOwners());
  r=tree.transact(()=>{rows.updateOne('a',{x:11});rows.updateOne('a',{x:mode==='netzero'?7:13});});
  for(const cell of life.pendingOwners())if(!old.has(cell))names.set(cell,'r');
  await flush();snapshot();
  if(mode==='later-confirmed'){phase='confirm-s';const oldS=new Set(life.pendingOwners());const newer=tree.transact(()=>rows.updateOne('a',{x:19}));for(const cell of life.pendingOwners())if(!oldS.has(cell))names.set(cell,'s');newer.confirm();await flush();snapshot();}
  if(r){phase='reject-r';let error:unknown;try{r.rollback();rRejected=true;}catch(e){error=e;}await flush();snapshot(error);}
  phase='reject-q';let error:unknown;try{q.rollback();qRejected=true;}catch(e){error=e;}await flush();snapshot(error);
  appendFileSync(process.env['ST_OBSERVATIONS']!,JSON.stringify({mode,route,observe,stages,captures,packets})+'\n');
 }finally{runtime.prepareEntityResponsibility=original;off();if(r&&!rRejected)r.confirm();if(!qRejected)q.confirm();c.dispose();tree.destroy();}
});
