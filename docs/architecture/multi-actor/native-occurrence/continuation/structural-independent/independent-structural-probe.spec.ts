import {expect,it} from 'vitest';
import {appendFileSync} from 'node:fs';
import {entityMap,signalTree,transactions} from '../index';
import {getTreeRealizationPort} from './internals/causal-runtime/tree-realization-adapter';
import type {ReversalEffect} from './internals/causal-runtime/causal-types';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {withWriteContext} from './write-context';
const raw=(v:unknown)=>appendFileSync('/private/tmp/st-structural-admission-independent/probes.jsonl',JSON.stringify(v)+'\n');
for(const context of [false,true])it(`ordinary remove presence, complete context=${context}`,()=>{
 const t=signalTree({rows:entityMap<{id:number},number>()},{enhancers:[transactions()]});
 try {
 const source=getEntityPublicationBinding(t.$.rows)!.source; source.evidence();
 t.$.rows.addOne({id:1});t.$.rows.addOne({id:2});
 const subject=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!;
 const owner=getOwnedPositionIds(t.$.rows)![0];const p=getTreeRealizationPort(t.$)!;
 const e:ReversalEffect={owner,subjectId:subject,structural:'remove',before:1,after:undefined,...(context?{structuralContext:{kind:'remove' as const,subject,key:1,value:{id:1}}}:{})};
 const validate=(t.$.rows as unknown as {__validateOrdinaryStructure(e:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure;
 withWriteContext({participation:'inspection',origin:'devtools',intent:'system'},()=>t.$.rows.removeOne(1));
 expect(validate([e])).toBe(true);const before=source.evidence()!.member(subject,'ordinary');
 const a=p.prepareOrdinaryEffects!([e]);expect(p.validateEffects(a)).toBeUndefined();p.applyAtomically(a);
 const stillPresent=validate([e]);raw({context,stillPresent,sameRequirement:before===source.evidence()!.member(subject,'ordinary'),ids:t.$.rows.ids()});
 expect(t.$.rows.ids()).toEqual([2]);expect(stillPresent).toBe(false);
 expect(p.validateEffects(a)).toEqual({kind:'structural-drift'});expect(()=>p.applyAtomically(a)).toThrow();
 }finally{t.destroy();}
});
it('numeric/string vacancy without bypassing handoff route',()=>{
 const t=signalTree({rows:entityMap<{id:string|number},string|number>()},{enhancers:[transactions()]});try{
 t.$.rows.addOne({id:1});t.$.rows.addOne({id:'2'});const p=getTreeRealizationPort(t.$)!;
 const e:ReversalEffect={owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,structural:'rekey',before:1,after:2};
 const a=p.prepareOrdinaryEffects!([e]);expect(p.validateEffects(a)).toBeUndefined();p.applyAtomically(a);expect(t.$.rows.ids()).toEqual([2,'2']);
 }finally{t.destroy();}
});
it('preparation reentry refuses outer installation and preserves independent scalar write',()=>{
 const t=signalTree({n:0,rows:entityMap<{id:number},number>()},{enhancers:[transactions()]});let off=()=>{};
 try{t.$.rows.addOne({id:1});const source=getEntityPublicationBinding(t.$.rows)!.source;const p=getTreeRealizationPort(t.$)!;
 const e:ReversalEffect={owner:getOwnedPositionIds(t.$.rows)![0],subjectId:getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,structural:'rekey',before:1,after:2};
 const a=p.prepareOrdinaryEffects!([e]);expect(p.validateEffects(a)).toBeUndefined();let calls=0;
 off=source.subscribe({prepare(){calls++;t.$.n(9);return undefined;},complete(){}});
 expect(()=>p.applyAtomically(a)).toThrow();expect(calls).toBeGreaterThan(0);expect(t.$.rows.ids()).toEqual([1]);expect(t.$.n()).toBe(9);
 expect(()=>p.applyAtomically(a)).toThrow();
 }finally{off();t.destroy();}
});
it('ordinary-only remove plus member omission installs as one unit',()=>{
 const t=signalTree({branch:{v:0},rows:entityMap<{id:number},number>()},{enhancers:[transactions()]});
 try{t.$.rows.addOne({id:1});const p=getTreeRealizationPort(t.$)!;const subject=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!;
 withWriteContext({participation:'inspection',origin:'devtools',intent:'system'},()=>t.$.rows.removeOne(1));
 const remove:ReversalEffect={owner:getOwnedPositionIds(t.$.rows)![0],subjectId:subject,structural:'remove',before:1,after:undefined,structuralContext:{kind:'remove',subject,key:1,value:{id:1}}};
 const member:ReversalEffect={owner:getOwnedPositionIds(t.$.branch)![0],before:undefined,after:undefined,plainBranchMembership:{before:true,after:false}};
 const a=p.prepareOrdinaryEffects!([remove,member]);expect(p.validateEffects(a)).toBeUndefined();let error:unknown;try{p.applyAtomically(a);}catch(e){error=e;}
 const present=Object.prototype.propertyIsEnumerable.call(t.$,'branch');const ordinary=(t.$.rows as unknown as {__validateOrdinaryStructure(e:readonly ReversalEffect[]):boolean}).__validateOrdinaryStructure([remove]);raw({mixed:true,error:String(error),branchPresent:present,ordinaryRowPresent:ordinary});
 expect(error).toBeUndefined();expect(present).toBe(false);expect(ordinary).toBe(false);
 }finally{t.destroy();}
});
