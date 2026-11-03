import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {preparePointRealization} from './internals/causal-runtime/tree-realization-adapter';
for(const change of ['enroll','dispose'] as const)it(`prepared mixed source refuses ${change} before any installation`,()=>{
 const t=signalTree({left:entityMap<{id:number;n:number},number>(),right:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});let off=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
 try{
  const nodes=[t.$.left,t.$.right];for(const node of nodes)node.addOne({id:1,n:0});
  const effects=nodes.map(node=>({owner:getOwnedPositionIds(node)![0],subjectId:getEntityPublicationBinding(node.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}));
  const plan=preparePointRealization(t,effects);expect(plan).toBeDefined();
  const source=getEntityPublicationBinding(t.$.right)!.source;
  if(change==='enroll')off=source.subscribe({prepare(){return {record:{writes:[],adds:[]},completion:{}};},complete(){ /* This participant has no completion side effect. */ }});else source.dispose();
  let error:unknown;try{plan!.install();}catch(e){error=e;}
  console.log(JSON.stringify({change,refused:error!==undefined,values:nodes.map(n=>n.byIdOrFail(1).n())}));
  expect(error).toBeDefined();expect(nodes.map(n=>n.byIdOrFail(1).n())).toEqual([0,0]);
 }finally{off();t.destroy();}
});
