import {expect,it,vi} from 'vitest';
import {appendFileSync} from 'node:fs';
import {link,signalTree,transactions} from '../index';
import * as life from './experimental-publication/lifecycle';
import {getPathNotifier} from './path-notifier';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
type C=ReturnType<typeof link>&{declare(d:{kind:'independent'|'unknown'},work:()=>unknown):unknown};
for(const kind of ['independent','unknown'] as const)it(`private later-preparer native evidence ${kind}`,async()=>{
 const o=signalTree({z:0},{enhancers:[transactions()]}),t=signalTree({pair:{x:0,y:0}});const a=link(t.$.pair,{set:()=>{}}) as C,b=link(t.$.pair,{set:()=>{}});let q:ReturnType<typeof o.transact>|undefined;
 const spy=vi.spyOn(life,'prepareNativeRequirement');const off=preparePublicationMutations(t.$.pair.x,()=>{q=o.transact(()=>o.$.z(7));return undefined;},()=>{})!;
 try{a.declare({kind},()=>t.$.pair(v=>({...v,x:1})));expect(q).toBeDefined();const first=spy.mock.results[0];expect(first.type).toBe('return');const requirement=first.value.requirement as life.NativeRequirement;const proof=life.nativeProof(requirement);
 expect(life.nativeRequirementReady(requirement)).toBe(true);expect(proof.destination??[]).toEqual([]);expect(proof.input??[]).toEqual([]);expect(proof.validation??[]).toEqual([]);expect(proof.invalid).toBe(false);expect(proof.unknown).toBe(kind==='unknown');expect(proof.possible??[]).toHaveLength(kind==='unknown'?1:0);
 appendFileSync(process.env['ST_PACKET_PAIR_OUTPUT']!,JSON.stringify({kind,proof:{...proof,owners:proof.owners.map(c=>c.outcome),destination:proof.destination?.map(c=>c.outcome),input:proof.input?.map(c=>c.outcome),validation:proof.validation?.map(c=>c.outcome),possible:proof.possible?.map(c=>c.outcome)}})+'\n');
 }finally{off();spy.mockRestore();a.dispose();b.dispose();q?.confirm();t.destroy();o.destroy();getPathNotifier().flushSync();}
});
