import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as lifecycle from './experimental-publication/lifecycle';
import type {NativeInput,NativeRequirement,OwnerCell} from './experimental-publication/lifecycle';
type View={requirement:NativeRequirement};
const text=readFileSync(process.env.ST_INPUT_SOURCE!,'utf8');
const start=text.indexOf('function nativeInputs('),end=text.indexOf('\nfunction nativeAuthorship',start);
if(start<0||end<0)throw Error('nativeInputs source boundary missing');
const compiled=ts.transpile(text.slice(start,end)+'\nreturn nativeInputs;', {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
// Execute the ACTUAL checked-in private function with controlled private inputs.
// This is research instrumentation, not a runtime export or proposed normal spec.
function subject(views:()=>View[],capture:(r:NativeRequirement)=>NativeInput=lifecycle.captureNativeInput,entity?:{source:{captureInput:()=>{native:readonly NativeInput[]}}}){
 const factory=new Function('getEntityPublicationBinding','suppliedViews','lifecycle',compiled);
 return factory(()=>entity,views,{captureNativeInput:capture}) as (node:object)=>NativeInput[];
}
for(const shape of ['empty','single','duplicate','distinct'] as const)it(`native input cardinality ${shape}`,()=>{
 const a=lifecycle.initialRequirement(),b=lifecycle.initialRequirement(),seen:NativeRequirement[]=[];
 const list=shape==='empty'?[]:shape==='single'?[a]:shape==='duplicate'?[a,a]:[a,b];let supplied=0;
 const run=subject(()=>{supplied++;return list.map(requirement=>({requirement}));},r=>{seen.push(r);return lifecycle.captureNativeInput(r);});
 const first=run({}),second=run({}),expected=shape==='empty'?[]:shape==='distinct'?[a,b]:[a];
 expect(supplied).toBe(2);expect(first.map(x=>x.requirement)).toEqual(expected);expect(seen).toEqual([...expected,...expected]);expect(second).not.toBe(first);
 for(const input of first){expect(Object.isFrozen(input)).toBe(true);expect(Object.isFrozen(input.owners)).toBe(true);}
});
for(const outcome of ['pending','confirmed','rolled-back','abandoned'] as const)it(`capture preserves actual lifecycle owner ${outcome}`,()=>{
 const owner:OwnerCell={owner:400,id:1,outcome,dependents:new Set()};
 const req:NativeRequirement={...lifecycle.initialRequirement(),proof:{owners:[owner],unknown:false,invalid:false}};
 const input=subject(()=>[{requirement:req}])({})[0];
 expect(input.requirement).toBe(req);expect(input.owners).toEqual(outcome==='confirmed'?[]:[owner]);
 owner.outcome='confirmed';expect(input.owners).toEqual(outcome==='confirmed'?[]:[owner]);expect(Object.isFrozen(input.owners)).toBe(true);
});
it('unavailable proof and retained old result survive later replacement',()=>{
 const old=lifecycle.unavailableRequirement(),fresh=lifecycle.initialRequirement(),view={requirement:old};
 const run=subject(()=>[view]);const held=run({});view.requirement=fresh;const next=run({});expect(held[0].requirement).toBe(old);expect(next[0].requirement).toBe(fresh);expect(lifecycle.nativeProof(held[0].requirement).unavailableInput).toBe(true);expect(next).not.toBe(held);
});
it('sample requirement once before capture reentry; retain captured old receipt',()=>{
 const old=lifecycle.initialRequirement(),next=lifecycle.unavailableRequirement();let current=old;const events:string[]=[];
 const view={get requirement(){events.push('read');return current;}};
 const run=subject(()=>{events.push('supplied');return [view];},r=>{events.push('capture');current=next;return lifecycle.captureNativeInput(r);});
 const first=run({});expect(events).toEqual(['supplied','read','capture']);expect(first[0].requirement).toBe(old);expect(run({})[0].requirement).toBe(next);expect(first[0].requirement).toBe(old);
});
for(const failure of [undefined,17,Object.freeze({sentinel:true})])it(`first capture error and recovery ${String(failure)}`,()=>{
 const r=lifecycle.initialRequirement();let armed=true,calls=0,failed=false,caught:unknown='unset';
 const run=subject(()=>[{requirement:r}],req=>{calls++;if(armed)throw failure;return lifecycle.captureNativeInput(req);});
 try{run({});}catch(error){failed=true;caught=error;}expect(failed).toBe(true);expect(caught).toBe(failure);expect(calls).toBe(1);armed=false;expect(run({})[0].requirement).toBe(r);expect(calls).toBe(2);
});
it('entity-bound capture bypass remains and output membership is copied',()=>{
 const input=lifecycle.captureNativeInput(lifecycle.initialRequirement()),native=Object.freeze([input]);let calls=0;
 const run=subject(()=>{throw Error('unexpected suppliedViews');},()=>{throw Error('unexpected scalar capture');},{source:{captureInput:()=>{calls++;return {native};}}});
 const result=run({});expect(result).toEqual(native);expect(result).not.toBe(native);expect(calls).toBe(1);
});
