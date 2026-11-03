import {expect,it,vi} from 'vitest';
import { writeDiagnostic } from '../../test/optional-diagnostic';
import {signalTree,transactions,link} from '../index';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];
type Receipt={read():Readonly<{state:string;basis?:string;reason?:string}>};
type Declared=ReturnType<typeof link>&{declare(input:{kind:'independent'|'unknown'},work:()=>unknown):Receipt};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<100;i++)await Promise.resolve();};
const output=diagnosticDirectory ? `${diagnosticDirectory}/recipient-traces.jsonl` : undefined;
for(const scope of ['scalar','branch'] as const)it(`equal unknown proof retains pending predecessor and no-write receipt: ${scope}`,async()=>{
 const o=signalTree({z:0},{enhancers:[transactions()]});const t=signalTree({x:0,pair:{x:0,y:0}});const sent:unknown[]=[];const c=link(scope==='scalar'?t.$.x:t.$.pair,{set:v=>{sent.push(v);}}) as Declared;const p=o.transact(()=>o.$.z(7));
 const write=()=>{if(scope==='scalar')t.$.x(1);else t.$.pair({x:1,y:0});};
 try{const first=c.declare({kind:'unknown'},write);await flush();expect(sent).toEqual([]);const second=c.declare({kind:'unknown'},write);await flush();writeDiagnostic(output,JSON.stringify({scope,first:first.read(),second:second.read(),sent})+'\n',true);expect(second.read()).toMatchObject({state:'no-write'});expect(first.read()).toMatchObject({state:'conservative'});expect(sent).toEqual([]);p.confirm();await flush();expect(sent).toEqual([scope==='scalar'?1:{x:1,y:0}]);expect(first.read()).toMatchObject({state:'started',basis:'surviving'});expect(second.read()).toMatchObject({state:'no-write'});}finally{c.dispose();t.destroy();o.destroy();}
});

for(const known of [false,true])it(`trace actual native input vs recipient-only wider uncertainty: known=${known}`,async()=>{
 const o=signalTree({z:0},{enhancers:[transactions()]});const t=signalTree({x:0,pair:{x:0,y:0}},{enhancers:[transactions()]});const sent:unknown[]=[];const c=link(t.$.pair,{set:v=>{sent.push(v);}}) as Declared;const p=known?t.transact(()=>t.$.x(7)):o.transact(()=>o.$.z(7));
 const original=life.prepareRevision;const records:unknown[]=[];let sawKnown=false,sawCoverage=false;const spy=vi.spyOn(life,'prepareRevision').mockImplementation((...args)=>{
  const native=args[5]?life.nativeProof(args[5]):undefined;
  const role=(cells:readonly life.OwnerCell[]|undefined)=>cells?.map(c=>({owner:c.owner,id:c.id,outcome:c.outcome}));
  if(native?.input?.some(c=>c.outcome==='pending'))sawKnown=true;if(args[3]&&Object.values(args[3]).some(Boolean))sawCoverage=true;
  records.push({unknown:args[3],native:native&&{unknown:native.unknown,invalid:native.invalid,historicalWindow:native.historicalWindow,input:role(native.input),destination:role(native.destination),validation:role(native.validation),possible:role(native.possible)}});
  return original(...args);
 });
 try{let error:unknown,receipt:Receipt|undefined;try{receipt=c.declare({kind:'independent'},()=>t.$(input=>({...input,pair:{x:input.x+(known?0:1),y:input.pair.y}})));}catch(e){error=e;}
 await flush();writeDiagnostic(output,JSON.stringify({known,records,error:error&&{code:(error as {code?:string}).code,stage:(error as {stage?:string}).stage,reason:(error as {reason?:string}).reason},receipt:receipt?.read(),sent})+'\n',true);
 expect(sawCoverage).toBe(true);expect(sawKnown).toBe(known);expect(sent).toEqual(known?[]:[{x:1,y:0}]);if(known)expect(error).toMatchObject({stage:'after-callback',reason:'contradiction'});else{expect(error).toBeUndefined();expect(receipt?.read()).toMatchObject({state:'started',basis:'surviving'});}p.confirm();await flush();expect(sent).toEqual([{x:known?7:1,y:0}]);
 }finally{spy.mockRestore();c.dispose();t.destroy();o.destroy();}
});

it('a finalizer throw installs neither recipient authority nor prepared writes',async()=>{
 const {preparePublicationMutations}=await import('./internals/intrinsic-mutation');
 const o=signalTree({z:0},{enhancers:[transactions()]});const t=signalTree({x:0});const sent:unknown[]=[];const a=link(t.$.x,{set:()=>{ /* This connection supplies the declaration without recording deliveries. */ }}) as Declared,b=link(t.$.x,{set:v=>{sent.push(v);}});const p=o.transact(()=>o.$.z(7));const records=new Map<unknown,unknown>();let complete=0,finalized=0;const initial=life.diagnostics().operations;
 const off=preparePublicationMutations(t.$.x,()=>({record:{writes:[{map:records,key:1,value:7}],adds:[]},completion:{},finalize(){finalized++;expect(records.size).toBe(0);expect(t.$.x()).toBe(0);throw Error('review-finalize-abort');}}),()=>{complete++;});
 try{expect(()=>a.declare({kind:'independent'},()=>t.$.x(7))).toThrow();expect(finalized).toBe(1);expect(t.$.x()).toBe(0);expect(records.size).toBe(0);expect(complete).toBe(0);await flush();expect(life.diagnostics().operations).toBe(initial);expect(sent).toEqual([]);p.confirm();await flush();expect(sent).toEqual([]);}finally{off?.();a.dispose();b.dispose();t.destroy();o.destroy();}
});
