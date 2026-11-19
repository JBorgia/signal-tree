import {writeFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {peekInternalTransactionRuntime} from '../enhancers/transactions/transactions';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {interceptLocationWrites} from './internals/location-runtime';
import {observeIntrinsicMutations} from './internals/intrinsic-mutation';
import {getPathNotifier} from './path-notifier';
import {nativeProof,type NativeRequirement} from './experimental-publication/lifecycle';
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};
for(const mode of ['second-refuses','final-observer-throws','final-interceptor-throws'] as const)it(`unchanged native two required units: ${mode}`,async()=>{
 const t=signalTree({rows:entityMap<{id:string;x:number;y:number},string>()},{enhancers:[transactions()]});const rows=t.$.rows;
 rows.addOne({id:'a',x:0,y:0});await flush();const row=rows.byIdOrFail('a');const b=getEntityPublicationBinding(row)!;
 const req=(key:string)=>b.source.evidence()!.field(b.subject!,key,'ordinary') as NativeRequirement;
 const baseline={x:req('x'),y:req('y')};const runtime=peekInternalTransactionRuntime(t)!;
 const q=t.transact(()=>{rows.updateOne('a',{x:7});rows.updateOne('a',{y:11});});await flush();
 const authored={x:req('x'),y:req('y')};const calls:string[]=[];const sentinel=new Error(mode);let atSecond:unknown;
 const snap=()=>({x:row.x(),y:row.y(),xBaseline:req('x')===baseline.x,yBaseline:req('y')===baseline.y,xAuthored:req('x')===authored.x,yAuthored:req('y')===authored.y,pending:runtime.getPendingTurnCount(),xProofJson:JSON.stringify(nativeProof(req('x'))),yProofJson:JSON.stringify(nativeProof(req('y')))});
 const offY=interceptLocationWrites(row.y,(_op,proceed)=>{calls.push('y');proceed();calls.push('y-return');});
 const offX=interceptLocationWrites(row.x,(_op,proceed)=>{calls.push('x');atSecond=snap();if(mode==='second-refuses')throw sentinel;proceed();if(mode==='final-interceptor-throws')throw sentinel;});
 const observer=mode==='final-observer-throws'?observeIntrinsicMutations(row.x,()=>{calls.push('x-observer');throw sentinel;}):undefined;
 try{
  expect(runtime.getPendingTurnCount()).toBe(1);let failure:unknown;try{q.rollback();}catch(e){failure=e;}
  const after=snap();offX();offY();observer?.();let retryError:unknown;try{q.rollback();}catch(e){retryError=e;}
  writeFileSync(`/private/tmp/st-native-partial-install-diagnostic/observations-v2-${mode}.json`,JSON.stringify({mode,calls,atSecond,after,error:failure instanceof Error?failure.message:String(failure),errorIsSentinel:failure===sentinel,retryError:retryError instanceof Error?retryError.message:String(retryError),afterRetry:snap()}));
  // Route assertions: registered projection interception is exclusive to the actual perEffect setter path.
  expect(calls.slice(0,3)).toEqual(['y','y-return','x']);expect(atSecond).toMatchObject({x:7,y:0,xAuthored:true,yBaseline:true});
  expect(after).toMatchObject(mode==='second-refuses'?{x:7,y:0,xAuthored:true,yBaseline:true}:{x:0,y:0,xBaseline:true,yBaseline:true});
  if(mode==='final-observer-throws')expect(calls).toContain('x-observer');
 }finally{offX();offY();observer?.();t.destroy();}
});
it('normal live scalar plus selected entity field chooses prepared point route',async()=>{
 const t=signalTree({plain:0,rows:entityMap<{id:string;x:number},string>()},{enhancers:[transactions()]});t.$.rows.addOne({id:'a',x:0});await flush();
 const row=t.$.rows.byIdOrFail('a'),b=getEntityPublicationBinding(row)!,base=b.source.evidence()!.field(b.subject!,'x','ordinary');
 const q=t.transact(()=>{t.$.plain(3);t.$.rows.updateOne('a',{x:7});});await flush();let perEffectCalls=0;
 const off=interceptLocationWrites(row.x,()=>{perEffectCalls++;throw new Error('unexpected perEffect route');});
 try{q.rollback();writeFileSync('/private/tmp/st-native-partial-install-diagnostic/observations-v2-mixed.json',JSON.stringify({perEffectCalls,plain:t.$.plain(),x:row.x(),baseline:b.source.evidence()!.field(b.subject!,'x','ordinary')===base,pending:peekInternalTransactionRuntime(t)!.getPendingTurnCount()}));expect(perEffectCalls).toBe(0);expect(t.$.plain()).toBe(0);expect(row.x()).toBe(0);}finally{off();t.destroy();}
});
