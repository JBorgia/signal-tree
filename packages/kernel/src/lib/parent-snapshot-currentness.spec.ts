import {expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {signalTree,link,transactions} from '../index';
import {registerMembershipPublication} from './internals/intrinsic-mutation';
import {materializeMember,ordinaryBranch,registerMarkerProcessor} from './internals/materialize-markers';
import {getLocationRuntime} from './internals/location-runtime';

type Image=Record<string,{n:number}>;
type Cell={():number;(value:number):void;};
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
  off();const after=rows();record(`kernel-${keyed?'keyed':'ordinary'}`,{calls,seen,physical,supplied,after});
  expect(calls).toBe(1);expect(physical).toBe(1);expect.soft(seen).toEqual({a:{n:1}});expect.soft(supplied).toEqual({a:{n:1},b:{n:2}});expect.soft(after).toEqual({a:{n:1},b:{n:2}});expect(child(rows,'a')).toBe(held);
 held!.n(3);child(rows,'b').n(4);
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
 const {t,rows}=setup(false);try{rows({a:{n:1}});const first=rows();const root=t.$();for(let i=0;i<100;i++){expect(rows()).toBe(first);expect(t.$()).toBe(root);} t.$.sibling.n(21);expect(rows()).toBe(first);expect(t.$().sibling).toEqual({n:21});}finally{t.destroy();}
});

it('no observer or snapshot demand performs no derived output work; counter has positive calibration',()=>{
 const {t,rows}=setup(false);const runtime=getLocationRuntime(rows);if(!runtime)throw Error('missing actual location runtime');const original=runtime.createDerived.bind(runtime);let computations=0;
 const spy=vi.spyOn(runtime,'createDerived').mockImplementation(<T>(compute:()=>T)=>original(()=>{computations++;return compute();}));
 try{rows({a:{n:1}});child(rows,'a').n(7);expect(computations).toBe(0);expect(rows()).toEqual({a:{n:7}});expect(computations).toBeGreaterThan(0);const count=computations;const first=rows();for(let i=0;i<100;i++)expect(rows()).toBe(first);expect(computations).toBe(count);}finally{spy.mockRestore();t.destroy();}
});
