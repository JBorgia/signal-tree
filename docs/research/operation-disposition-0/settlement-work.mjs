import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {StructuralStore} from '@proof/packages/kernel/src/lib/physical/structural-store.ts';
const runs=[];
for(const N of [128,1024,8192]) for(const mixed of [false,true]) for(const settle of ['confirm','rollback']) {
 const t=signalTree({n:0,rows:entityMap()},{enhancers:[transactions()]});
 const original=StructuralStore.prototype.activeKeysSnapshot;let phase='outside';const calls=[];
 try {
  t.$.rows.setAll(Array.from({length:N},(_,i)=>({id:String(i),n:0})));
  StructuralStore.prototype.activeKeysSnapshot=function(...args){const keys=original.apply(this,args);if(phase!=='outside')calls.push({phase,length:keys.length,stack:new Error().stack?.split('\n').slice(1,7)});return keys;};
  phase='capture';const p=t.transact(()=>{if(mixed)t.$.n(1);t.$.rows.updateOne('0',{n:1});});phase='outside';
  assert.equal(t.$.rows.byIdOrFail('0').n(),1);assert.equal(t.$.n(),mixed?1:0);
  phase='settlement';let error;try{p[settle]();}catch(e){error=String(e);}phase='outside';
  const expected=settle==='rollback'?0:1;
  assert.equal(t.$.rows.byIdOrFail('0').n(),expected);assert.equal(t.$.n(),mixed?expected:0);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),0);
  runs.push({N,mixed,settle,error,calls});
 }finally{StructuralStore.prototype.activeKeysSnapshot=original;t.destroy();}
}
console.log(JSON.stringify({limits:'Counts snapshot calls and returned entries processed by readTransitionSource, not total work or elapsed time. Capture/settlement isolated; seeding/assertions excluded.',runs},null,2));
