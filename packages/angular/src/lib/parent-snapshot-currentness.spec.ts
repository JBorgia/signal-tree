import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {signalTree,link,transactions} from '../index';
import {computed,isSignal} from '@angular/core';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {registerMembershipPublication} from '../../../kernel/src/lib/internals/intrinsic-mutation';
// eslint-disable-next-line @nx/enforce-module-boundaries -- White-box regression exercises private kernel/realization coordination.
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from '../../../kernel/src/lib/internals/materialize-markers';

type Image=Record<string,{n:number}>;
type Cell={():number;set(value:number):void;update(fn:(n:number)=>number):void;};
type Child={():{n:number};n:Cell};
type Rows={():Image;(value:Image):void;[key:string]:unknown};
const KIND=Symbol('parent-currentness-keyed');type Marker={[KIND]:true;seed:Image};
registerMarkerProcessor((v:unknown):v is Marker=>typeof v==='object'&&v!==null&&KIND in v,(m:Marker)=>ordinaryBranch(m.seed,{keyedLookup:true}));
function setup(keyed:boolean){
 const t=signalTree({rows:keyed?({[KIND]:true,seed:{}} as Marker):({} as Image),sibling:{n:20}},{enhancers:[transactions()]});
 const rows=t.$.rows as unknown as Rows;return{t,rows};
}
function child(rows:Rows,key:string):Child{const x=rows[key];if(typeof x!=='function'||!('n'in x)||typeof x.n!=='function')throw Error('missing actual installed child');return x as Child;}
function record(name:string,value:unknown){const out=process.env.ST_PREPARED_REVIEW_OUTPUT;if(out)writeFileSync(join(out,name+'.json'),JSON.stringify(value,null,2));}
for(const keyed of [false,true])it(`fresh read-derived completion retains a and nested b: ${keyed?'keyed':'ordinary'}`,()=>{
 const {t,rows}=setup(keyed);const l=link(rows,{set:()=>{ /* Destination values are intentionally discarded in this protocol fixture. */ }});const sentinel=Error('completion sentinel');let calls=0;let seen:unknown;let physical:unknown;let held:Child|undefined;let supplied:unknown;
 rows();
 const off=registerMembershipPublication(e=>e.branch===rows&&e.key==='a'&&e.ordinary?.before.present===false?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{calls++;seen=rows();held=child(rows,'a');physical=held.n();const next={...rows(),b:{n:2}};supplied=next;rows(next);throw sentinel;});
 try{
  expect(()=>keyed?materializeMember(rows,'a',{n:1}):rows({a:{n:1}})).toThrow(sentinel);
  off();const after=rows();record(`angular-${keyed?'keyed':'ordinary'}`,{calls,seen,physical,supplied,after});
  expect(calls).toBe(1);expect(physical).toBe(1);expect.soft(seen).toEqual({a:{n:1}});expect.soft(supplied).toEqual({a:{n:1},b:{n:2}});expect.soft(after).toEqual({a:{n:1},b:{n:2}});expect(child(rows,'a')).toBe(held);
 required(held).n.set(3);child(rows,'b').n.update(n=>n+2);
  expect(rows()).toEqual({a:{n:3},b:{n:4}});
 }finally{off();l.dispose();t.destroy();}
});

it('fresh ancestor and sibling identity during completion; no repeated-read churn',()=>{
 const {t,rows}=setup(false);const rootBefore=t.$();const sibling=t.$.sibling();let seen:unknown;let rootDuring:{rows:unknown;sibling:{n:number}}|undefined;let first:Image|undefined;let repeat=false;let calls=0;
 const off=registerMembershipPublication(e=>e.branch===rows&&e.key==='a'?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{calls++;first=rows();seen=first;rootDuring=t.$();repeat=Array.from({length:100},()=>rows()).every(v=>v===first);});
 try{rows({a:{n:1}});expect(calls).toBe(1);expect.soft(seen).toEqual({a:{n:1}});expect(rootDuring?.rows).toEqual({a:{n:1}});expect(rootDuring).not.toBe(rootBefore);expect(rootDuring?.sibling).toBe(sibling);expect(repeat).toBe(true);expect(rows()).toBe(first);expect(t.$()).toBe(rootDuring);}
 finally{off();t.destroy();}
});

it('ordinary unchanged reads and unrelated writes preserve memo identities',()=>{
 const {t,rows}=setup(false);try{rows({a:{n:1}});const first=rows();const root=t.$();for(let i=0;i<100;i++){expect(rows()).toBe(first);expect(t.$()).toBe(root);} t.$.sibling.n.set(21);expect(rows()).toBe(first);expect(t.$().sibling).toEqual({n:21});}finally{t.destroy();}
});

it('warmed Angular computed preserves notification timing while direct held reader is current',()=>{
 const {t,rows}=setup(false);const direct=rows;let runs=0;const cached=computed(()=>{runs++;return rows();});const before=cached();const initialRuns=runs;let insideNative:unknown;let insideDirect:unknown;let insideRuns=0;let calls=0;
 const off=registerMembershipPublication(e=>e.branch===rows&&e.key==='a'?{record:{writes:[],adds:[]},completion:{}}:undefined,()=>{calls++;insideNative=cached();insideRuns=runs;insideDirect=direct();});
 try{rows({a:{n:1}});const current=cached();record('angular-native-timing',{calls,insideNative,insideDirect,insideRuns,initialRuns,after:current,runs});expect(calls).toBe(1);expect(isSignal(child(rows,'a').n)).toBe(true);expect(insideNative).toBe(before);expect(insideRuns).toBe(initialRuns);expect(current).toEqual({a:{n:1}});expect(runs).toBeGreaterThan(initialRuns);expect(insideDirect).toEqual({a:{n:1}});}finally{off();t.destroy();}
});

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error("Fixture expected a present value");
  return value;
}
