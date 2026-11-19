import {replaceLocation,isWritableLocation} from '../../../kernel/src/lib/internals/location-runtime';
import {it,expect} from 'vitest';
import {signalTree,transactions,link} from '../index';
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from '../../../kernel/src/lib/internals/materialize-markers';
import {registerMembershipPublication} from '../../../kernel/src/lib/internals/intrinsic-mutation';
import {getTreeScalarSlotRuntime} from '../../../kernel/src/lib/internals/tree-scalar-slot-port';
import {getMutationCaptureRuntime} from '../../../kernel/src/lib/internals/mutation-capture-runtime';
const M=Symbol('routes-review');type Marker={[M]:true;seed:Record<string,unknown>};
registerMarkerProcessor((v:unknown):v is Marker=>typeof v==='object'&&v!==null&&M in v,m=>ordinaryBranch(m.seed,{keyedLookup:true}));
type Row={():{n:number};n:{():number;(v:number):void}};
type Branch={():Record<string,{n:number}>;(v:Record<string,{n:number}>):void;[key:string]:unknown};
function write(row:Row,value:number){if(!isWritableLocation(row.n))throw Error('missing native writer');replaceLocation(row.n,value);}
function setup(keyed:boolean){const state={rows:keyed?{[M]:true,seed:{}} as Marker:{}};const t=signalTree(state,{enhancers:[transactions()]});const rows=t.$.rows as unknown as Branch;const l=link(rows,{set:()=>{}});return{t,rows,l,rt:getTreeScalarSlotRuntime(t.$)!,add(key:string,n:number){if(keyed)return materializeMember(rows,key,{n}) as Row;rows({...rows(),[key]:{n}});return rows[key] as Row;}};}
for(const keyed of [false,true]){
 it(`route keyed=${keyed}: same-key successful reentry refuses stale outer with exact source pairing`,()=>{
  const s=setup(keyed);let busy=false;let nested:Row|undefined;let outer:Row|undefined;const pairs:Array<{branch:object;key:string;child:unknown}>=[];const cap=getMutationCaptureRuntime(s.t.$)!;const original=cap.prepareMemberResponsibility;cap.prepareMemberResponsibility=(branch,key,child,presence)=>{pairs.push({branch,key,child});return original?.(branch,key,child,presence);};
  const off=registerMembershipPublication(edit=>{if(edit.branch===s.rows&&edit.key==='a'&&!busy){busy=true;outer=edit.child as Row;nested=s.add('a',7);}return undefined;},()=>{});
  try{expect(()=>s.add('a',1)).toThrow();expect(s.rows.a).toBe(nested);expect(s.rows()).toEqual({a:{n:7}});expect(s.rt.slotCount()).toBe(1);expect(pairs.filter(p=>p.branch===s.rows&&p.key==='a').map(p=>p.child)).toEqual([outer,nested]);write(outer!,99);write(nested!,8);expect(s.rows()).toEqual({a:{n:8}});}
  finally{off();cap.prepareMemberResponsibility=original;s.l.dispose();s.t.destroy();}
 });
 it(`route keyed=${keyed}: installed receipt survives completion reentry and throw`,()=>{
  const s=setup(keyed);const receipts=new Map<object,object>();const keys=new Map<string,object>();const completions:string[]=[];const error=Error('outer completion');let first:Row|undefined;
  const off=registerMembershipPublication(edit=>{if(edit.branch!==s.rows||edit.ordinary?.before.present!==false)return undefined;const key={};keys.set(edit.key,key);if(edit.key==='a')first=edit.child as Row;return{record:{writes:[{map:receipts,key,value:edit.child as object}],adds:[]},completion:edit.key};},value=>{completions.push(value as string);if(value==='a'){s.add('b',2);throw error;}});
  try{expect(()=>s.add('a',1)).toThrow(error);off();expect(completions).toEqual(['a','b']);expect(s.rows.a).toBe(first);expect(receipts.get(keys.get('a')!)).toBe(first);expect(receipts.get(keys.get('b')!)).toBe(s.rows.b);expect(s.rt.slotCount()).toBe(2);expect(s.rows()).toEqual({a:{n:1},b:{n:2}});write(first!,3);write((s.rows.b as Row),4);expect(s.rows()).toEqual({a:{n:3},b:{n:4}});}
  finally{off();s.l.dispose();s.t.destroy();}
 });
 it(`route keyed=${keyed}: detached write rejects stale prepared payload without attachment`,()=>{
  const s=setup(keyed);let held:Row|undefined;const off=registerMembershipPublication(edit=>{if(edit.branch===s.rows&&edit.key==='a'){held=edit.child as Row;write(held,9);}return undefined;},()=>{});
  try{expect(()=>s.add('a',1)).toThrow(/Detached member changed/);off();expect(s.rows()).toEqual({});expect(s.rt.slotCount()).toBe(0);expect(held!.n()).toBe(9);const live=s.add('a',7);write(held!,10);expect(live.n()).toBe(7);expect(s.rt.slotCount()).toBe(1);}
  finally{off();s.l.dispose();s.t.destroy();}
 });
}
