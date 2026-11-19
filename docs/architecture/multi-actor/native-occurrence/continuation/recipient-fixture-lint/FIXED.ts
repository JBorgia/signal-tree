import {expect,it,vi} from 'vitest';
import {link,signalTree,transactions} from '../index';
import * as life from './experimental-publication/lifecycle';
import {installTerminalRecord} from './internals/intrinsic-mutation';
import {getPathNotifier} from './path-notifier';
type Declared=ReturnType<typeof link>&{declare(d:{kind:'independent'}|{kind:'dependent';owners:readonly object[]},work:()=>unknown):{read():{state:string;basis?:string}}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<80;i++)await Promise.resolve();};

it('source evidence permits surviving delivery but does not authorize the next unscoped write',async()=>{
 const t=signalTree({pair:{x:0,y:0}}),o=signalTree({z:0},{enhancers:[transactions()]});
 const one:unknown[]=[],two:unknown[]=[];const starts=vi.spyOn(life,'started');
 const a=link(t.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(t.$.pair,{set:v=>{two.push(v);}});const q=o.transact(()=>o.$.z(7));
 try{const receipt=a.declare({kind:'independent'},()=>t.$.pair(v=>({...v,x:1})));await flush();
  expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual(one);expect(receipt.read()).toEqual({state:'started',basis:'declared'});
  expect(starts.mock.calls.map(c=>c[2]).sort()).toEqual(['declared','surviving']);
  t.$.pair.x(2);await flush();expect(two).toEqual([{x:1,y:0}]);expect(one).toEqual(two);
  q.confirm();await flush();expect(two).toEqual([{x:1,y:0},{x:2,y:0}]);expect(one).toEqual(two);
 }finally{a.dispose();b.dispose();t.destroy();o.destroy();starts.mockRestore();}
});

it('whole support retains the untouched actual destination owner',async()=>{
 const t=signalTree({pair:{x:0,y:0}},{enhancers:[transactions()]});const one:unknown[]=[],two:unknown[]=[];
 const a=link(t.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(t.$.pair,{set:v=>{two.push(v);}});
 const q=t.transact(()=>t.$.pair.y(7));
 try{a.declare({kind:'independent'},()=>t.$.pair.x(1));await flush();expect(t.$.pair()).toEqual({x:1,y:7});expect(one).toEqual([]);expect(two).toEqual([]);
  q.confirm();await flush();expect(one).toEqual([{x:1,y:7}]);expect(two).toEqual(one);
 }finally{a.dispose();b.dispose();t.destroy();}
});

it('an enrolled recipient cannot publish before the enclosing horizon closes or escape its invalidation',async()=>{
 const t=signalTree({pair:{x:0,y:0}}),o=signalTree({z:0},{enhancers:[transactions()]});const one:unknown[]=[],two:unknown[]=[];
 const a=link(t.$.pair,{set:v=>{one.push(v);}}) as Declared,b=link(t.$.pair,{set:v=>{two.push(v);}});const q=o.transact(()=>o.$.z(7));
 try{expect(()=>a.declare({kind:'independent'},()=>{t.$.pair.x(1);getPathNotifier().flushSync();expect(one).toEqual([]);expect(two).toEqual([]);throw Error('invalid horizon');})).toThrow('invalid horizon');
  await flush();expect(t.$.pair.x()).toBe(1);expect(one).toEqual([]);expect(two).toEqual([]);
  q.confirm();await flush();expect(one).toEqual([{x:1,y:0}]);expect(two).toEqual(one);
 }finally{a.dispose();b.dispose();t.destroy();o.destroy();}
});

for(const cause of ['no-native','unobservedOrigin','invalidAttribution','uncapturedUpdaterInput','recipientDomain'] as const)
it(`recipient source separation preserves ${cause} uncertainty`,()=>{
 const channel={};life.registerConnection(channel,{supported:true,report:()=>{/* This fixture observes state directly. */},wake:()=>{/* Delivery is driven explicitly by this fixture. */}});const revision={};
 try{const uncertainty=cause==='no-native'?{}:{[cause]:true};const plan=life.prepareRevision(channel,revision,[],uncertainty,[],cause==='no-native'?undefined:life.initialRequirement());
  plan.finalize?.();installTerminalRecord(plan);expect(life.proof(channel,revision)?.unknown).toBe(true);expect(life.hasDeclaration(channel,revision)).toBe(false);
 }finally{life.disposeConnection(channel);}
});

it('nondeclaring source requirement remains unfinished until both activation and parent finalization',()=>{
 const parent={},recipient={};for(const channel of [parent,recipient])life.registerConnection(channel,{supported:true,report:()=>{/* This fixture observes state directly. */},wake:()=>{/* Delivery is driven explicitly by this fixture. */}});
 let native!:life.NativeRequirement;const revision={};const observed:boolean[]=[];
 try{expect(()=>life.runDeclaration(parent,{kind:'independent'},()=>{
  const p=life.prepareNativeRequirement([],false,[]);native=p.requirement;installTerminalRecord(p.record);life.finalizeNativeRequirement(native);
  const r=life.prepareRevision(recipient,revision,[],{},[],native);r.finalize?.();installTerminalRecord(r);
  life.onNativeRequirementReady(native,()=>observed.push(life.nativeProof(native).invalid));
  expect(life.nativeRequirementReady(native)).toBe(false);life.deliverNativeRequirementReady(native);expect(life.nativeRequirementReady(native)).toBe(false);expect(observed).toEqual([]);
  expect(life.hasDeclaration(recipient,revision)).toBe(false);throw Error('native invalid');
 })).toThrow('native invalid');expect(life.nativeRequirementReady(native)).toBe(true);expect(observed).toEqual([true]);
 }finally{life.disposeConnection(parent);life.disposeConnection(recipient);}
});
