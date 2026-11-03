import { expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { getTreeRealizationPort, getTreeRealizationDescriptors } from './internals/causal-runtime/tree-realization-adapter';
import type { ReversalEffect } from './internals/causal-runtime/causal-types';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { getOwnedPositionIds } from './internals/owned-mutation';
import { getPhysicalCommitClock } from './internals/physical-commit-clock';
import { withWriteContext } from './write-context';
const inspect=(fn:()=>void)=>withWriteContext({participation:'inspection',origin:'devtools',intent:'system'},fn);
const make=()=>{
 const t=signalTree({n:7,rows:entityMap<{id:number;name:string},number>()},{enhancers:[transactions()]});
 t.$.rows.addOne({id:1,name:'original'});t.$.rows.addOne({id:2,name:'neighbor'});
 const binding=getEntityPublicationBinding(t.$.rows)!,subject=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!;
 const owner=getOwnedPositionIds(t.$.rows)![0],p=getTreeRealizationPort(t.$)!;
 const remove:ReversalEffect={owner,subjectId:subject,structural:'remove',before:1,after:undefined};
 const present=()=> (t.$.rows as unknown as {__validateOrdinaryStructure(e:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure([remove]);
 return {t,binding,subject,owner,p,remove,present};
};
for(const scalarFirst of [false,true])it(`incomplete ordinary removal refuses whole unit scalarFirst=${scalarFirst}`,()=>{
 const c=make();let stop=()=>{};try{
 inspect(()=>c.t.$.rows.removeOne(1));expect(c.present()).toBe(true);
 const revision=getPhysicalCommitClock(c.t.$)!.revision();
 const support=c.binding.source.evidence()!.member(c.subject,'ordinary');let deliveries=0;
 stop=c.binding.source.subscribe({prepare(){deliveries++;return undefined;},complete(){deliveries++;}});
 const scalar:ReversalEffect={owner:getOwnedPositionIds(c.t.$.n)![0],before:7,after:0};
 const a=c.p.prepareOrdinaryEffects!(scalarFirst?[scalar,c.remove]:[c.remove,scalar]);
 expect(c.p.validateEffects(a)).toEqual({kind:'structural-drift'});
 expect(()=>c.p.applyAtomically(a)).toThrow();
 expect(c.t.$.n()).toBe(7);expect(c.t.$.rows.ids()).toEqual([2]);expect(c.present()).toBe(true);
 expect(getPhysicalCommitClock(c.t.$)!.revision()).toBe(revision);
 expect(c.binding.source.evidence()!.member(c.subject,'ordinary')).toBe(support);expect(deliveries).toBe(0);
 }finally{stop();c.t.destroy();}
});
it('complete removal context installs ordinary absence and cannot replay',()=>{
 const c=make();try{
 inspect(()=>c.t.$.rows.removeOne(1));expect(c.present()).toBe(true);
 const e:ReversalEffect={...c.remove,structuralContext:{kind:'remove',subject:c.subject,key:1,value:{id:1,name:'original'}}};
 const a=c.p.prepareOrdinaryEffects!([e]);expect(c.p.validateEffects(a)).toBeUndefined();c.p.applyAtomically(a);
 expect(c.present()).toBe(false);expect(c.t.$.rows.ids()).toEqual([2]);expect(c.t.$.n()).toBe(7);
 expect(c.p.validateEffects(a)).toEqual({kind:'structural-drift'});expect(()=>c.p.applyAtomically(a)).toThrow();
 }finally{c.t.destroy();}
});
it('descriptor-resolved add carries captured recipe into ordinary installation',()=>{
 const c=make();try{
 c.t.transact(()=>c.t.$.rows.removeOne(1));expect(c.present()).toBe(false);
 const descriptors=getTreeRealizationDescriptors(c.t.$)!;
 const descriptor=descriptors.get(c.owner);expect(descriptor).toBeDefined();
 expect(descriptor?.structuralEffectBySubject?.get(String(c.subject))).toBeDefined();
 const e:ReversalEffect={owner:c.owner,subjectId:c.subject,structural:'add',before:undefined,after:1};
 const a=c.p.prepareOrdinaryEffects!([e]);expect(c.p.validateEffects(a)).toBeUndefined();c.p.applyAtomically(a);
 expect(c.present()).toBe(true);expect(c.t.$.rows.ids()).toEqual([1,2]);expect(c.t.$.rows.byIdOrFail(1).name()).toBe('original');
 expect(c.p.validateEffects(a)).toEqual({kind:'structural-drift'});
 }finally{c.t.destroy();}
});
it('legacy unlowered subject removal remains supported',()=>{
 const c=make();try{expect(c.p.validateEffects([c.remove])).toBeUndefined();c.p.applyAtomically([c.remove]);expect(c.t.$.rows.ids()).toEqual([2]);}finally{c.t.destroy();}
});
it('complete ordered remove permits subject-based obsolete key followed by rekey',()=>{
 const c=make();try{
 const second=getEntityPublicationBinding(c.t.$.rows.byIdOrFail(2))!.subject!;
 inspect(()=>c.t.$.rows.changeId(2,3));
 const remove:ReversalEffect={owner:c.owner,subjectId:second,structural:'remove',before:'obsolete',after:undefined,structuralContext:{kind:'remove',subject:second,key:2,value:{id:2,name:'neighbor'}}};
 const rekey:ReversalEffect={owner:c.owner,subjectId:c.subject,structural:'rekey',before:1,after:2};
 const a=c.p.prepareOrdinaryEffects!([remove,rekey]);expect(c.p.validateEffects(a)).toBeUndefined();c.p.applyAtomically(a);
 expect(c.t.$.rows.ids()).toEqual([2]);expect(c.t.$.rows.byIdOrFail(2).name()).toBe('original');
 }finally{c.t.destroy();}
});
