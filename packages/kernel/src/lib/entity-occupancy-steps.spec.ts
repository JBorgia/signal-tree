import {expect,it} from 'vitest';
import {signalTree,entityMap,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import {getEntityOrdinaryChanges} from './internals/entity-value-transition';
import {MUTATION_CAPTURE_RUNTIME,type CommittedEntityMutation,type MutationCaptureRuntime} from './internals/mutation-capture-runtime';

it('duplicate-key updateMany selects each prepared ordinary step once',async()=>{
 const tree=signalTree({rows:entityMap<{id:string;n:number},string>()},{enhancers:[transactions()]});
 const notifier=getPathNotifier();
 const runtime=(tree as unknown as Record<symbol,MutationCaptureRuntime>)[MUTATION_CAPTURE_RUNTIME];
 const paired: CommittedEntityMutation[]=[];const rich:CommittedEntityMutation[]=[];
 let off=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };let offCapture=()=>{ /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
 try{
  tree.$.rows.setAll([{id:'a',n:1},{id:'b',n:2}]);notifier.flushSync();
  offCapture=runtime.subscribeCommittedEntity!(capture=>paired.push(...capture.changes));
  off=notifier.subscribe('**',(_next,_old,_path,_base,_origin,_subjects,_positions,meta)=>{
   const changes=getEntityOrdinaryChanges(meta);if(changes)rich.push(...changes);
  });
  const pending=tree.transact(()=>tree.$.rows.updateMany(['a','b','a'],{n:5}));
  notifier.flushSync();
  expect(paired).toHaveLength(3);
  // Notifier coalesces paths; cross-path delivery is not operation chronology.
  // Stable sorting compares chronology within each subject, including before/after.
  expect(rich.slice().sort((a,b)=>a.subject-b.subject)).toEqual(paired.slice().sort((a,b)=>a.subject-b.subject));
  pending.rollback();
  expect(tree.$.rows.all()).toEqual([{id:'a',n:1},{id:'b',n:2}]);
 }finally{off();offCapture();tree.destroy();}
});
