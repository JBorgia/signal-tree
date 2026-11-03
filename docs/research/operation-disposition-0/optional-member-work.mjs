import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {StructuralStore} from '@proof/packages/kernel/src/lib/physical/structural-store.ts';
const result={control:process.argv[2],runs:[]};
for(const N of [128,1024,8192]) for(const settlement of ['confirm','rollback']) {
 const t=signalTree({meta:{n:0},rows:entityMap()},{enhancers:[transactions()]});
 const original=StructuralStore.prototype.activeKeysSnapshot;let measured=false;const calls=[];
 try{
  const seed=Array.from({length:N},(_,i)=>({id:String(i),n:0}));t.$.rows.setAll(seed);t.$.meta({});
  const pending=t.transact(()=>{t.$.meta.n(1);t.$.rows.updateOne('0',{n:1});});
  assert.equal(t.$.meta.n(),1);assert.equal(t.$.rows.byIdOrFail('0').n(),1);
  StructuralStore.prototype.activeKeysSnapshot=function(...args){const keys=original.apply(this,args);if(measured)calls.push({length:keys.length,stack:new Error().stack?.split('\n').slice(1,7)});return keys;};
  let error;measured=true;try{pending[settlement]();}catch(e){error=String(e);}measured=false;
  assert.equal(error,undefined);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),0);
  if(settlement==='rollback'){assert.deepEqual(t.$.meta(),{});assert.deepEqual(t.$.rows.all(),seed);pending.rollback();assert.deepEqual(t.$.rows.all(),seed);}
  else {assert.equal(t.$.meta.n(),1);assert.equal(t.$.rows.byIdOrFail('0').n(),1);pending.confirm();}
  result.runs.push({N,settlement,calls,error});
 }finally{StructuralStore.prototype.activeKeysSnapshot=original;t.destroy();}
}
console.log(JSON.stringify(result,null,2));
if(result.control==='zero-inventory') for(const run of result.runs) assert.equal(run.calls.length,0,'fixed optional-member + one-row settlement must retain baseline zero inventory work');
