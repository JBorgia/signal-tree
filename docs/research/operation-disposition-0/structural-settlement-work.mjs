import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {StructuralStore} from '@proof/packages/kernel/src/lib/physical/structural-store.ts';
const runs=[];
for(const N of [128,1024,8192]) for(const kind of ['update','add','remove','rekey']) for(const settle of ['confirm','rollback']) {
 const t=signalTree({n:0,rows:entityMap()},{enhancers:[transactions()]});
 const original=StructuralStore.prototype.activeKeysSnapshot;let phase='outside';const calls=[];
 try {
  t.$.rows.setAll(Array.from({length:N},(_,i)=>({id:String(i),n:0})));
  StructuralStore.prototype.activeKeysSnapshot=function(...args){const keys=original.apply(this,args);if(phase!=='outside')calls.push({phase,length:keys.length,stack:new Error().stack?.split('\n').slice(1,7)});return keys;};
  phase='capture';const p=t.transact(()=>{t.$.n(1);if(kind==='update')t.$.rows.updateOne('0',{n:1});else if(kind==='add')t.$.rows.addOne({id:'new',n:1});else if(kind==='remove')t.$.rows.removeOne('0');else t.$.rows.changeId('0','renamed');});phase='outside';
  assert.equal(t.$.n(),1);assert.equal(t.$.rows.count(),N+(kind==='add'?1:kind==='remove'?-1:0));
  phase='settlement';let error;try{p[settle]();}catch(e){error=String(e);}phase='outside';
  assert.equal(error,undefined,'settlement must succeed');
  const expected=settle==='rollback'?0:1;
  assert.equal(t.$.n(),expected);assert.equal(t.$.rows.count(),N+(settle==='confirm'?(kind==='add'?1:kind==='remove'?-1:0):0));if(settle==='rollback')assert.equal(t.$.rows.byIdOrFail('0').n(),0);else if(kind==='add')assert.equal(t.$.rows.byIdOrFail('new').n(),1);else if(kind==='rekey')assert.equal(t.$.rows.byIdOrFail('renamed').n(),0);else if(kind==='update')assert.equal(t.$.rows.byIdOrFail('0').n(),1);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),0);
  if(settle==='rollback')assert.deepEqual(t.$.rows.all(),Array.from({length:N},(_,i)=>({id:String(i),n:0})));
  runs.push({N,kind,settle,error,calls});
 }finally{StructuralStore.prototype.activeKeysSnapshot=original;t.destroy();}
}
console.log(JSON.stringify({limits:'Counts snapshot calls and returned entries processed by readTransitionSource, not total work or elapsed time. Capture/settlement isolated; seeding/assertions excluded.',runs},null,2));
