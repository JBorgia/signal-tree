import {expect,it} from 'vitest';
import {entityMap,signalTree,transactions} from '../index';
import {getTreeRealizationPort} from './internals/causal-runtime/tree-realization-adapter';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {withWriteContext} from './write-context';
const inspect=(work:()=>void)=>withWriteContext({participation:'inspection',intent:'system',origin:'devtools'},work);
const make=()=>{
 const tree=signalTree({rows:entityMap<{id:string|number},string|number>()},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:1});tree.$.rows.addOne({id:2});
 const owner=getOwnedPositionIds(tree.$.rows)?.[0],port=getTreeRealizationPort(tree.$);
 const a=getEntityPublicationBinding(tree.$.rows.byIdOrFail(1))?.subject,b=getEntityPublicationBinding(tree.$.rows.byIdOrFail(2))?.subject;
 if(owner===undefined||a===undefined||b===undefined||!port?.prepareOrdinaryEffects)throw new Error('Native realization seam unavailable');
 const prepare=(effects:readonly ReversalEffect[])=>port.prepareOrdinaryEffects!(effects);
 const rekey=(subjectId:number,before:string|number,after:string|number):ReversalEffect=>({owner,subjectId,before,after,structural:'rekey'});
 // Preserve the seeded existence recipe independently of later physical inspection.
 const removalRecipes=new Map([
  [a,{key:1,value:{id:1}}],
  [b,{key:2,value:{id:2}}],
 ]);
 const remove=(subjectId:number,before:string|number):ReversalEffect=>{
  const recipe=removalRecipes.get(subjectId);
  if(!recipe)throw new Error('Removal fixture has no captured existence recipe');
  return {owner,subjectId,before,after:undefined,structural:'remove',structuralContext:{kind:'remove',subject:subjectId,...recipe}};
 };
 const add=(subjectId:number,after:string|number):ReversalEffect=>({owner,subjectId,before:undefined,after,structural:'add',structuralContext:{kind:'remove',subject:subjectId,key:after,value:{id:after}}});
 return {tree,port,prepare,a,b,rekey,remove,add};
};
it('ordinary destination occupancy survives inspection-only physical vacancy',()=>{
 const c=make();try{inspect(()=>c.tree.$.rows.changeId(2,3));const p=c.prepare([c.rekey(c.a,1,2)]);expect(c.port.validateEffects(p)).toEqual({kind:'structural-drift'});expect(c.tree.$.rows.ids()).toEqual([1,3]);}finally{c.tree.destroy();}
});
it('physical occupied destination still refuses after semantic vacancy succeeds',()=>{
 const c=make();try{inspect(()=>c.tree.$.rows.changeId(2,3));const p=c.prepare([c.rekey(c.a,1,3)]);expect(c.port.validateEffects(p)).toEqual({kind:'structural-drift'});expect(c.tree.$.rows.ids()).toEqual([1,3]);}finally{c.tree.destroy();}
});
it('ordered semantic vacancy permits remove by subject then rekey without strict remove-key broadening',()=>{
 const c=make();try{inspect(()=>c.tree.$.rows.changeId(2,3));const p=c.prepare([c.remove(c.b,'obsolete-key'),c.rekey(c.a,1,2)]);expect(c.port.validateEffects(p)).toBeUndefined();c.port.applyAtomically(p);expect(c.tree.$.rows.ids()).toEqual([2]);}finally{c.tree.destroy();}
});
it('ordinary duplicate add refuses even when inspection removed its physical lifetime',()=>{
 const c=make();try{inspect(()=>c.tree.$.rows.removeOne(1));const p=c.prepare([c.add(c.a,1)]);expect(c.port.validateEffects(p)).toEqual({kind:'structural-drift'});expect(c.tree.$.rows.ids()).toEqual([2]);}finally{c.tree.destroy();}
});
it('ordinary remove is admitted before physical omission and still completes ordinary authority',()=>{
 const c=make();try{const binding=getEntityPublicationBinding(c.tree.$.rows)!;const evidence=binding.source.evidence()!;inspect(()=>c.tree.$.rows.removeOne(1));const before=evidence.member(c.a,'ordinary');const p=c.prepare([c.remove(c.a,'obsolete-key')]);expect(c.port.validateEffects(p)).toBeUndefined();c.port.applyAtomically(p);expect(c.tree.$.rows.ids()).toEqual([2]);expect(evidence.member(c.a,'ordinary')).not.toBe(before);}finally{c.tree.destroy();}
});
it('ordinary absent physical present add uses original semantic absence before transfer',()=>{
 const c=make();try{inspect(()=>c.tree.$.rows.addOne({id:3}));const subject=getEntityPublicationBinding(c.tree.$.rows.byIdOrFail(3))!.subject!;const p=c.prepare([c.add(subject,3)]);expect(c.port.validateEffects(p)).toBeUndefined();c.port.applyAtomically(p);expect(c.tree.$.rows.ids()).toEqual([1,2,3]);}finally{c.tree.destroy();}
});
it('semantic occupancy preserves numeric and string keys',()=>{
 const c=make();try{c.tree.$.rows.addOne({id:'2'});const p=c.prepare([c.remove(c.b,2),c.rekey(c.a,1,2)]);expect(c.port.validateEffects(p)).toBeUndefined();c.port.applyAtomically(p);expect(c.tree.$.rows.ids()).toEqual([2,'2']);}finally{c.tree.destroy();}
});
it('prepared semantic admission is invalid after independent installation',()=>{
 const c=make();try{const p=c.prepare([c.rekey(c.a,1,4)]);expect(c.port.validateEffects(p)).toBeUndefined();c.tree.$.rows.changeId(1,5);expect(c.port.validateEffects(p)).toEqual({kind:'structural-drift'});expect(()=>c.port.applyAtomically(p)).toThrow();expect(c.tree.$.rows.ids()).toEqual([5,2]);}finally{c.tree.destroy();}
});
