import {expect,it} from 'vitest';
import {signalTree,entityMap,link} from '../index';
import {ordinaryBranch,registerMarkerProcessor,materializeMember} from './internals/materialize-markers';
import {getEntityPublicationBinding} from './internals/entity-publication';
const tag=Symbol('dynamic-collection-inventory');
registerMarkerProcessor((value:unknown):value is {[tag]:true}=>typeof value==='object'&&value!==null&&tag in value,()=>ordinaryBranch({}, {keyedLookup:true}));
const shape=()=>signalTree({rows:entityMap<{id:string;n:number},string>()});
type Rows=ReturnType<typeof shape>['$']['rows'];
const tick=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
it('inventories keyed ordinary construction of a genuine nested collection separately',async()=>{
 const t=signalTree({users:{[tag]:true}});const users=t.$.users as unknown as object;const sent:unknown[]=[];
 const l=link(users as never,{set:(value:unknown)=>{sent.push(value);}});
 try{
  const child=materializeMember(users,'b',{rows:entityMap<{id:string;n:number},string>()}) as {rows:Rows};
  expect(getEntityPublicationBinding(child.rows)).toBeDefined();await tick();
  expect(sent.at(-1)).toEqual({b:{rows:{all:[]}}});
  child.rows.addOne({id:'a',n:1});await tick();
  expect(sent.at(-1)).toEqual({b:{rows:{all:[{id:'a',n:1}]}}});
 }finally{l.dispose();t.destroy();}
});
