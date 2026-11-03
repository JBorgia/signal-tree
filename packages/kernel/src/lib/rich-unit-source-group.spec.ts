import {it,expect} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getTreeRealizationPort} from './internals/causal-runtime/tree-realization-adapter';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getMutationCaptureRuntime} from './internals/mutation-capture-runtime';
it('same-source restores retain proposed anchors, all rows and ordinary membership before observation',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[transactions()]});let off=()=>{};let release=()=>{};
 try{
 t.$.rows.addOne({id:1,n:11});t.$.rows.addOne({id:2,n:12});
 const a=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,b=getEntityPublicationBinding(t.$.rows.byIdOrFail(2))!.subject!;
 const owner=getOwnedPositionIds(t.$.rows)![0],p=getTreeRealizationPort(t.$)!;
 t.transact(()=>{t.$.rows.removeOne(1);t.$.rows.removeOne(2);});
 const effects:ReversalEffect[]=[{owner,subjectId:a,structural:'add',before:undefined,after:1,structuralContext:{kind:'remove',subject:a,key:1,value:{id:1,n:11},afterSubject:b}},{owner,subjectId:b,structural:'add',before:undefined,after:2,structuralContext:{kind:'remove',subject:b,key:2,value:{id:2,n:12},beforeSubject:a}}];
 const rt=getMutationCaptureRuntime(t.$.rows)!;release=rt.activateCapture();const seen:unknown[]=[];off=rt.subscribeCommittedEntity!(()=>seen.push(t.$.rows.all()));
 const prepared=p.prepareOrdinaryEffects!(effects);expect(p.validateEffects(prepared)).toBeUndefined();p.applyAtomically(prepared);
 expect(t.$.rows.all()).toEqual([{id:1,n:11},{id:2,n:12}]);expect(seen.length).toBeGreaterThan(0);for(const value of seen)expect(value).toEqual([{id:1,n:11},{id:2,n:12}]);
 const validate=(t.$.rows as unknown as {__validateOrdinaryStructure(e:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure;
 expect(validate([{owner,subjectId:a,structural:'remove',before:1,after:undefined},{owner,subjectId:b,structural:'remove',before:2,after:undefined}])).toBe(true);
 }finally{off();release();t.destroy();}
});
