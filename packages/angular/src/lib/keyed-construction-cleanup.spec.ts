import {computed,isSignal} from '@angular/core';
import {expect,it} from 'vitest';
import {signalTree,link,transactions} from '../index';
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from '../../../kernel/src/lib/internals/materialize-markers';
import {registerMembershipPublication} from '../../../kernel/src/lib/internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from '../../../kernel/src/lib/internals/tree-scalar-slot-port';
const DYN=Symbol('native-keyed-cleanup');type Marker={[DYN]:true;seed:Record<string,unknown>};
registerMarkerProcessor((v:unknown):v is Marker=>typeof v==='object'&&v!==null&&DYN in v,(m:Marker)=>ordinaryBranch(m.seed,{keyedLookup:true}));
type Branch={():Record<string,unknown>;[key:string]:unknown};type Cell={():number;set(value:number):void;update(fn:(n:number)=>number):void};type Child={n:Cell;more:Cell};

it('actual Angular keyed producer retains reentrant native identity and cancels refused recursive resources',()=>{
 const t=signalTree({rows:{[DYN]:true,seed:{}} as Marker},{enhancers:[transactions()]});const rows=t.$.rows as unknown as Branch;const l=link(rows,{set:()=>{}});const rt=getTreeScalarSlotRuntime(t.$)!;const start=rt.slotCount();let busy=false;let kept:Child|undefined;let escaped:Child|undefined;const fail=Error('native keyed refusal');
 const off=registerMembershipPublication(edit=>{if(edit.key==='a'&&!busy){busy=true;escaped=edit.child as Child;kept=materializeMember(rows,'kept',{n:7,more:8}) as Child;throw fail;}return undefined;},()=>{});
 try{expect(()=>materializeMember(rows,'a',{n:1,more:2})).toThrow(fail);off();expect(rows.kept).toBe(kept);expect(isSignal(kept!.n)).toBe(true);const current=computed(()=>kept!.n());expect(current()).toBe(7);kept!.n.set(9);kept!.n.update(n=>n+1);expect(current()).toBe(10);escaped!.n.set(99);expect(current()).toBe(10);expect(rows()).toEqual({kept:{n:10,more:8}});expect(rt.slotCount()).toBe(start+2);}
 finally{off();l.dispose();t.destroy();}
});

it('actual Angular keyed source pairs creation rollback and retained native identity',()=>{
 const t=signalTree({rows:{[DYN]:true,seed:{}} as Marker},{enhancers:[transactions()]});const rows=t.$.rows as unknown as Branch;const l=link(rows,{set:()=>{}});const rt=getTreeScalarSlotRuntime(t.$)!;
 try{let child:Child|undefined;const q=t.transact(()=>{child=materializeMember(rows,'a',{n:7,more:8}) as Child;});const count=rt.slotCount();expect(isSignal(child!.n)).toBe(true);q.rollback();expect(rows()).toEqual({});expect(materializeMember(rows,'a',{n:9,more:10})).toBe(child);expect(rt.slotCount()).toBe(count);const value=computed(()=>child!.n());expect(value()).toBe(9);child!.n.update(n=>n+1);expect(value()).toBe(10);}
 finally{l.dispose();t.destroy();}
});
