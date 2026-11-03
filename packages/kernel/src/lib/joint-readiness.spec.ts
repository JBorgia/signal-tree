import {expect,it} from 'vitest';
import {signalTree,transactions,link} from '../index';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getOwnedPositionIds} from './internals/owned-mutation';
import * as life from './experimental-publication/lifecycle';
for(const earlier of [true,false])it(`readiness reentry waits for installed siblings and post-seal registration earlier=${earlier}`,()=>{
 const t=signalTree({a:0,b:0},{enhancers:[transactions()]});const foreign=signalTree({x:0},{enhancers:[transactions()]});const requirements:life.NativeRequirement[]=[];const reads:unknown[]=[];let pending:ReturnType<typeof foreign.transact>|undefined;let lateCalls=0;
 const releases=[t.$.a,t.$.b].map((leaf,index)=>preparePublicationMutations(leaf,(_m,_i,native)=>{const requirement=(native as {requirement:life.NativeRequirement}).requirement;requirements.push(requirement);if(requirements.length<=2 && index===(earlier?0:1))life.onNativeRequirementReady(requirement,()=>{reads.push(t.$());pending=foreign.transact(()=>foreign.$.x(9));t.$.a(777);});return undefined;},()=>{})!);
 try{const runtime=getTreeScalarSlotRuntime(t.$)!;const frame=runtime.beginFrame();frame.set(runtime.resolveScalarSlot(getOwnedPositionIds(t.$.a)![0])!,1);frame.set(runtime.resolveScalarSlot(getOwnedPositionIds(t.$.b)![0])!,2);const install=frame.prepareCommit!({publish:false});
 expect(reads).toEqual([]);expect(requirements.every(r=>!life.nativeRequirementReady(r))).toBe(true);life.onNativeRequirementReady(requirements[1],()=>lateCalls++);expect(lateCalls).toBe(0);expect(t.$()).toEqual({a:0,b:0});const result=install();expect(reads).toEqual([]);runtime.publishPrepared(result);expect(reads[0]).toEqual({a:1,b:2});expect(t.$()).toEqual({a:777,b:2});expect(lateCalls).toBe(1);expect(requirements.slice(0,2).every(r=>life.nativeProof(r).possible?.length===0)).toBe(true);
 }finally{for(const off of releases)off();pending?.rollback();t.destroy();foreign.destroy();}
});
it('sealing and activation do not close an enclosing declaration horizon',()=>{
 const t=signalTree({a:0,b:0});const c=link(t.$,{set:()=>{}}) as ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>void):unknown};const seen:life.NativeRequirement[]=[];let callbacks=0;
 const releases=[t.$.a,t.$.b].map(leaf=>preparePublicationMutations(leaf,(_m,_i,n)=>{const r=(n as {requirement:life.NativeRequirement}).requirement;seen.push(r);life.onNativeRequirementReady(r,()=>callbacks++);return undefined;},()=>{})!);
 try{c.declare({kind:'independent'},()=>{t.$.a(1);expect(callbacks).toBe(0);expect(life.nativeRequirementReady(seen[0])).toBe(false);t.$.b(2);expect(callbacks).toBe(0);expect(seen.every(r=>!life.nativeRequirementReady(r))).toBe(true);});expect(callbacks).toBe(2);expect(seen.every(life.nativeRequirementReady)).toBe(true);}finally{for(const off of releases)off();c.dispose();t.destroy();}
});

it('horizon closes every installed source when one readiness subscriber throws',()=>{
 const t=signalTree({a:0,b:0});const c=link(t.$,{set:()=>{}}) as ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>void):unknown};const seen:life.NativeRequirement[]=[];const calls:number[]=[];const sentinel={tag:'readiness'};
 const releases=[t.$.a,t.$.b].map((leaf,index)=>preparePublicationMutations(leaf,(_m,_i,n)=>{const r=(n as {requirement:life.NativeRequirement}).requirement;seen.push(r);life.onNativeRequirementReady(r,()=>{calls.push(index);if(index===0)throw sentinel;});return undefined;},()=>{})!);
 try{let caught:unknown;try{c.declare({kind:'independent'},()=>{t.$.a(1);t.$.b(2);expect(calls).toEqual([]);});}catch(e){caught=e;}expect(caught).toBe(sentinel);expect(calls).toEqual([0,1]);expect(seen.every(life.nativeRequirementReady)).toBe(true);expect(life.diagnostics().activeFrames).toBe(0);expect(t.$()).toEqual({a:1,b:2});}finally{for(const off of releases)off();c.dispose();t.destroy();}
});
it('aborted scalar preparation cannot activate, and independent nested committed work survives',()=>{
 const t=signalTree({a:0,b:0},{enhancers:[transactions()]});const nested=signalTree({x:0});const requirements:life.NativeRequirement[]=[];let callbacks=0;const sentinel={tag:'preparation'};
 const a=preparePublicationMutations(t.$.a,(_m,_i,n)=>{const r=(n as {requirement:life.NativeRequirement}).requirement;requirements.push(r);life.onNativeRequirementReady(r,()=>callbacks++);return undefined;},()=>{})!;
 const b=preparePublicationMutations(t.$.b,()=>{nested.$.x(777);throw sentinel;},()=>{})!;
 try{const rt=getTreeScalarSlotRuntime(t.$)!;const f=rt.beginFrame();f.set(rt.resolveScalarSlot(getOwnedPositionIds(t.$.a)![0])!,1);f.set(rt.resolveScalarSlot(getOwnedPositionIds(t.$.b)![0])!,2);let caught:unknown;try{f.prepareCommit!({publish:false});}catch(e){caught=e;}expect(caught).toBe(sentinel);expect(t.$()).toEqual({a:0,b:0});expect(nested.$.x()).toBe(777);expect(requirements).toHaveLength(1);expect(life.nativeRequirementReady(requirements[0])).toBe(false);expect(callbacks).toBe(0);}finally{a();b();t.destroy();nested.destroy();}
});
it('cancelled readiness registration does not deliver on installed activation',()=>{
 const t=signalTree({a:0},{enhancers:[transactions()]});let r:life.NativeRequirement|undefined;let calls=0;
 const off=preparePublicationMutations(t.$.a,(_m,_i,n)=>{r=(n as {requirement:life.NativeRequirement}).requirement;const cancel=life.onNativeRequirementReady(r,()=>calls++);cancel();return undefined;},()=>{})!;
 try{t.$.a(1);expect(r).toBeDefined();expect(life.nativeRequirementReady(r!)).toBe(true);expect(calls).toBe(0);}finally{off();t.destroy();}
});
it('two installed writes remain validating until a throwing declaration closes invalid',()=>{
 const t=signalTree({a:0,b:0});const c=link(t.$,{set:()=>{}}) as ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>void):unknown};const seen:life.NativeRequirement[]=[];const sentinel={tag:'body'};const proofs:life.Proof[]=[];
 const releases=[t.$.a,t.$.b].map(leaf=>preparePublicationMutations(leaf,(_m,_i,n)=>{const r=(n as {requirement:life.NativeRequirement}).requirement;seen.push(r);life.onNativeRequirementReady(r,()=>proofs.push(life.nativeProof(r)));return undefined;},()=>{})!);
 try{let caught:unknown;try{c.declare({kind:'independent'},()=>{t.$.a(1);t.$.b(2);expect(proofs).toEqual([]);expect(seen.every(r=>!life.nativeRequirementReady(r))).toBe(true);throw sentinel;});}catch(e){caught=e;}expect(caught).toBe(sentinel);expect(proofs).toHaveLength(2);expect(proofs.every(p=>p.invalid)).toBe(true);}finally{for(const off of releases)off();c.dispose();t.destroy();}
});
it('readiness callback error cannot replace declaration body error or strand sibling activation',()=>{
 const t=signalTree({a:0,b:0});const c=link(t.$,{set:()=>{}}) as ReturnType<typeof link>&{declare(input:{kind:'independent'},body:()=>void):unknown};const body={tag:'body'},subscriber={tag:'subscriber'};const calls:number[]=[];
 const releases=[t.$.a,t.$.b].map((leaf,index)=>preparePublicationMutations(leaf,(_m,_i,n)=>{const r=(n as {requirement:life.NativeRequirement}).requirement;life.onNativeRequirementReady(r,()=>{calls.push(index);if(index===0)throw subscriber;});return undefined;},()=>{})!);
 try{let caught:unknown;try{c.declare({kind:'independent'},()=>{t.$.a(1);t.$.b(2);throw body;});}catch(e){caught=e;}expect(caught).toBe(body);expect(calls).toEqual([0,1]);expect(life.diagnostics().activeFrames).toBe(0);}finally{for(const off of releases)off();c.dispose();t.destroy();}
});
