import {expect,it} from 'vitest';
import {signalTree,entityMap,restoration,undoable} from '../index';
import {getEntityPublicationBinding} from './internals/entity-publication';
import {getTreeRealizationPort} from './internals/causal-runtime/tree-realization-adapter';
import {getOwnedPositionIds} from './internals/owned-mutation';
import {preparePublicationMutations} from './internals/intrinsic-mutation';
import {getPathNotifier} from './path-notifier';
for(const nested of [false,true])it(`actual preparation seam refuses mixed unit without partial stores nested=${nested}`,()=>{
 const t=signalTree({status:'pending',other:'unchanged',rows:entityMap<{id:number;n:number},number>()},{enhancers:[restoration()]});let off=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };let stop=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
 try{t.$.rows.addOne({id:1,n:11});getPathNotifier().flushSync();const subject=getEntityPublicationBinding(t.$.rows.byIdOrFail(1))!.subject!,owner=getOwnedPositionIds(t.$.rows)![0],status=getOwnedPositionIds(t.$.status)![0],p=getTreeRealizationPort(t.$)!;const history=t.getRestorationHistory().length;const sent:unknown[]=[];stop=getPathNotifier().subscribe('**',(value,_prev,path)=>{if(path==='status'||path==='rows')sent.push(value);});const sentinel={tag:'prepare'};
 off=preparePublicationMutations(t.$.status,()=>{if(nested)undoable(()=>t.$.other('newer'));else throw sentinel;return undefined;},()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
 let caught:unknown;try{p.applyAtomically([{owner,subjectId:subject,before:1,after:2,structural:'rekey'},{owner:status,before:'pending',after:'shipped'}]);}catch(e){caught=e;}
 if(nested)expect(String(caught)).toContain('Reentrant scalar preparation');else expect(caught).toBe(sentinel);
 getPathNotifier().flushSync();expect(t.$.rows.ids()).toEqual([1]);expect(t.$.rows.byIdOrFail(1).n()).toBe(11);expect(t.$.status()).toBe('pending');expect(t.$.other()).toBe(nested?'newer':'unchanged');expect(t.getRestorationHistory().length).toBe(history+(nested?1:0));expect(sent).toEqual([]);
 }finally{off();stop();t.destroy();}
});
it('same-source structure and surviving row values compose before first rich callback',()=>{
 const t=signalTree({rows:entityMap<{id:number;n:number},number>()},{enhancers:[restoration()]});
 try{t.$.rows.setAll([{id:1,n:11},{id:2,n:12}]);getPathNotifier().flushSync();undoable(()=>{t.$.rows.removeOne(1);t.$.rows.byIdOrFail(2).n(60);});getPathNotifier().flushSync();expect(t.$.rows.all()).toEqual([{id:2,n:60}]);t.undo();getPathNotifier().flushSync();expect(t.$.rows.all()).toEqual([{id:1,n:11},{id:2,n:12}]);expect(t.$.rows.byIdOrFail(2).n()).toBe(12);}finally{t.destroy();}
});
