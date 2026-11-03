import {getPositionRegistry} from './internals/position-registry';
import {getOwnedPositionIds} from './internals/owned-metadata';
import {expect,it} from 'vitest';
import {link,signalTree,transactions} from '../index';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from './internals/tree-scalar-slot-port';
import {getMutationCaptureRuntime} from './internals/mutation-capture-runtime';
import {getPathNotifier} from './path-notifier';
type Row={n:{():number;(value:number):void}};
const flush=async()=>{getPathNotifier().flushSync();for(let i=0;i<120;i++)await Promise.resolve();};

for(const sameKey of [false,true])it(`refused construction preserves independently installed ${sameKey?'same-key':'other-key'} handle and releases only its own allocation`,async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];
 const l=link(t.$.rows,{set:v=>{sent.push(v);}});const rt=getTreeScalarSlotRuntime(t.$)!;
 const before=rt.slotCount();const fail=Error('refused outer');let nested:Row|undefined;let escaped:Row|undefined;let busy=false;
 const off=registerMembershipPublication(edit=>{
  if(edit.key!=='a'||busy)return;busy=true;escaped=edit.child as Row;
  t.$.rows(sameKey?{a:{n:7}}:{kept:{n:7}});nested=t.$.rows[sameKey?'a':'kept'] as Row;
  throw fail;
 },()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{
  expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);off();await flush();
  const key=sameKey?'a':'kept';expect(t.$.rows()).toEqual({[key]:{n:7}});expect(t.$.rows[key]).toBe(nested);
  nested!.n(8);await flush();expect(sent.at(-1)).toEqual({[key]:{n:8}});
  const delivered=sent.length;escaped!.n(99);await flush();expect(sent.length).toBe(delivered);expect(t.$.rows()).toEqual({[key]:{n:8}});
  expect(rt.slotCount()).toBe(before+1);
 }finally{off();l.dispose();t.destroy();}
});

it('responsibility preparation refusal releases detached construction before membership preparation',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>},{enhancers:[transactions()]});const l=link(t.$.rows,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});
 const rt=getTreeScalarSlotRuntime(t.$)!;const capture=getMutationCaptureRuntime(t.$)!;const original=capture.prepareMemberResponsibility;const before=rt.slotCount();const fail=Error('responsibility preparation refused');
 capture.prepareMemberResponsibility=(branch,key,child,presence)=>{if(key==='a')throw fail;return original?.(branch,key,child,presence);};
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);expect(t.$.rows()).toEqual({});expect(rt.slotCount()).toBe(before);}
 finally{capture.prepareMemberResponsibility=original;l.dispose();t.destroy();}
});

it('postinstallation completion throw preserves installed identity storage and terminal record',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});
 const rt=getTreeScalarSlotRuntime(t.$)!;const before=rt.slotCount();const records=new Map<object,object>();const token={};const completion={};const fail=Error('completion after install');let child:Row|undefined;let completions=0;
 const off=registerMembershipPublication(edit=>{if(edit.key!=='a')return;child=edit.child as Row;return{record:{writes:[{map:records,key:token,value:child}],adds:[]},completion};},()=>{completions++;throw fail;});
 try{
  expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);off();expect(completions).toBe(1);expect(t.$.rows.a).toBe(child);expect(records.get(token)).toBe(child);expect(t.$.rows()).toEqual({a:{n:1}});expect(rt.slotCount()).toBe(before+1);
  child!.n(2);await flush();expect(t.$.rows()).toEqual({a:{n:2}});expect(sent.at(-1)).toEqual({a:{n:2}});
 }finally{off();l.dispose();t.destroy();}
});

it('detached child mutation invalidates its prepared payload without publishing or acquiring rollback responsibility',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>},{enhancers:[transactions()]});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});const rt=getTreeScalarSlotRuntime(t.$)!;const start=rt.slotCount();let escaped:Row|undefined;
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'){escaped=edit.child as Row;escaped.n(99);}return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(/Detached member changed/);off();await flush();expect(sent).toEqual([]);expect(t.$.rows()).toEqual({});expect(rt.slotCount()).toBe(start);const q=t.transact(()=>t.$.rows({a:{n:7}}));const installed=t.$.rows.a as Row;escaped!.n(100);expect(installed.n()).toBe(7);q.rollback();await flush();expect(t.$.rows()).toEqual({});}
 finally{off();l.dispose();t.destroy();}
});

it('same-key installation during preparation invalidates outer plan and preserves nested responsibility',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>},{enhancers:[transactions()]});const l=link(t.$.rows,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});const rt=getTreeScalarSlotRuntime(t.$)!;const start=rt.slotCount();let busy=false;let nested:Row|undefined;
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'&&!busy){busy=true;t.$.rows({a:{n:7}});nested=t.$.rows.a as Row;}return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(/changed/);off();expect(t.$.rows.a).toBe(nested);expect(t.$.rows()).toEqual({a:{n:7}});expect(rt.slotCount()).toBe(start+1);nested!.n(8);expect(t.$.rows()).toEqual({a:{n:8}});}
 finally{off();l.dispose();t.destroy();}
});

it('cancellation removes exact position and leaf registrations while retained failed branch cannot route to the root',async()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>},{enhancers:[transactions()]});const sent:unknown[]=[];const l=link(t.$.rows,{set:v=>{sent.push(v);}});const runtime=getTreeScalarSlotRuntime(t.$)!;
 const registry=getPositionRegistry(t.$)!;let failed:Row|undefined;let ids:readonly number[]=[];const fail=Error('resource refusal');
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'){failed=edit.child as Row;ids=getOwnedPositionIds(failed.n)??[];throw fail;}return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);off();expect(ids.length).toBeGreaterThan(0);for(const id of ids){expect(registry.addressFor(id)).toBeUndefined();expect(registry.parentOf(id)).toBeUndefined();expect(runtime.resolveScalarSlot(id)).toBeUndefined();expect(runtime.resolveScalarLeaf(id)).toBeUndefined();}expect(getTreeScalarSlotRuntime(failed)).toBeUndefined();expect(getPositionRegistry(failed)).toBeUndefined();failed!.n(9);await flush();expect(sent).toEqual([]);expect(t.$.rows()).toEqual({});}
 finally{off();l.dispose();t.destroy();}
});
