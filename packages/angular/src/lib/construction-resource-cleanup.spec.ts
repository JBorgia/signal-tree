import {computed,isSignal} from '@angular/core';
import {expect,it} from 'vitest';
import {link,signalTree} from '../index';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {registerMembershipPublication} from '../../../kernel/src/lib/internals/intrinsic-mutation';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {getTreeScalarSlotRuntime} from '../../../kernel/src/lib/internals/tree-scalar-slot-port';
type Row={n:{():number;set(value:number):void;update(fn:(value:number)=>number):void}};
it('native Angular refused construction preserves reentrant native cell identity and releases only abandoned storage',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const l=link(t.$.rows,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});const rt=required(getTreeScalarSlotRuntime(t.$));const start=rt.slotCount();let busy=false;let kept:Row|undefined;let escaped:Row|undefined;const fail=Error('native refused outer');
 const off=registerMembershipPublication(edit=>{if(edit.key!=='a'||busy)return;busy=true;escaped=edit.child as Row;t.$.rows({kept:{n:7}});kept=t.$.rows.kept as Row;throw fail;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ });
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);off();expect(isSignal(required(kept).n)).toBe(true);expect(t.$.rows.kept).toBe(kept);const value=computed(()=>required(kept).n());expect(value()).toBe(7);required(kept).n.set(8);expect(value()).toBe(8);required(kept).n.update(n=>n+1);expect(value()).toBe(9);required(escaped).n.set(99);expect(value()).toBe(9);expect(t.$.rows()).toEqual({kept:{n:9}});expect(rt.slotCount()).toBe(start+1);}
 finally{off();l.dispose();t.destroy();}
});

it('native cell identity survives installed completion error and subsequent set/update',()=>{
 const t=signalTree({rows:{} as Record<string,{n:number}>});const l=link(t.$.rows,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});const rt=required(getTreeScalarSlotRuntime(t.$));const start=rt.slotCount();let prepared:Row|undefined;const fail=Error('native installed completion');
 const off=registerMembershipPublication(edit=>{if(edit.key!=='a')return;prepared=edit.child as Row;return{record:{writes:[],adds:[]},completion:{}};},()=>{throw fail;});
 try{expect(()=>t.$.rows({a:{n:1}})).toThrow(fail);off();expect(isSignal(required(prepared).n)).toBe(true);expect(t.$.rows.a).toBe(prepared);expect(rt.slotCount()).toBe(start+1);const current=computed(()=>required(prepared).n());expect(current()).toBe(1);required(prepared).n.set(2);expect(current()).toBe(2);required(prepared).n.update(n=>n+1);expect(current()).toBe(3);expect(t.$.rows()).toEqual({a:{n:3}});}
 finally{off();l.dispose();t.destroy();}
});

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Fixture expected a present value");
  return value;
}
