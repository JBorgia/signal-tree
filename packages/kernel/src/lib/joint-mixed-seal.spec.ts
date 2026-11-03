import {expect,it} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {preparePointRealization} from './internals/causal-runtime/tree-realization-adapter';
import {getPositionRegistry} from './internals/position-registry';
import * as life from './experimental-publication/lifecycle';
for(const reverse of [false,true])it(`all mixed source preparations precede sealing reverse=${reverse}`,()=>{
 const t=signalTree({left:entityMap<{id:number;n:number},number>(),right:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});const foreign=signalTree({x:0},{enhancers:[transactions()]});let pending:ReturnType<typeof foreign.transact>|undefined;const off:Array<()=>void>=[];const seen:life.NativeRequirement[]=[];
 try{t.$.left.addOne({id:1,n:0});t.$.right.addOne({id:1,n:0});const nodes=reverse?[t.$.right,t.$.left]:[t.$.left,t.$.right];const effects=nodes.map(node=>({owner:getOwnedPositionIds(node)![0],subjectId:getEntityPublicationBinding(node.byIdOrFail(1))!.subject!,subjectFieldSegments:['n'],before:0,after:1}));
 nodes.forEach((node,index)=>off.push(getEntityPublicationBinding(node)!.source.subscribe({prepare(_packet,native){seen.push((native as {requirement:life.NativeRequirement}).requirement);if(index===1)pending=foreign.transact(()=>foreign.$.x(7));return undefined;},complete(){}})));
 const plan=preparePointRealization(t,effects);expect(plan).toBeDefined();expect(t.$.left.byIdOrFail(1).n()).toBe(0);expect(seen).toHaveLength(2);expect(seen.every(r=>!life.nativeRequirementReady(r))).toBe(true);const owner=getPositionRegistry(foreign.$)!.id;expect(seen.every(r=>life.nativeProof(r).possible?.some(cell=>cell.owner===owner))).toBe(true);plan!.install();expect(seen.every(r=>!life.nativeRequirementReady(r))).toBe(true);plan!.publish();expect(seen.every(life.nativeRequirementReady)).toBe(true);expect(t.$.left.byIdOrFail(1).n()).toBe(1);expect(t.$.right.byIdOrFail(1).n()).toBe(1);
 }finally{for(const stop of off)stop();pending?.rollback();t.destroy();foreign.destroy();}
});
