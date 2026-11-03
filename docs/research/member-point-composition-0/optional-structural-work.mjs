import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {StructuralStore} from '@proof/packages/kernel/src/lib/physical/structural-store.ts';
const result={control:process.argv[2],runs:[]};
for(const N of [128,1024,8192]) for(const kind of ['add','remove','rekey']) for(const settlement of ['confirm','rollback']) {
 const t=signalTree({meta:{n:0},rows:entityMap()},{enhancers:[transactions()]});
 const original=StructuralStore.prototype.activeKeysSnapshot;let measured=false;const calls=[];
 try{
  const seed=Array.from({length:N},(_,i)=>({id:String(i),n:0}));t.$.rows.setAll(seed);t.$.meta({});
  const changed=kind==='add'?[...seed,{id:'new',n:1}]:kind==='remove'?seed.slice(1):seed;
  const pending=t.transact(()=>{t.$.meta.n(1);if(kind==='add')t.$.rows.addOne({id:'new',n:1});else if(kind==='remove')t.$.rows.removeOne('0');else t.$.rows.changeId('0','renamed');});
  assert.deepEqual(t.$.meta(),{n:1});assert.deepEqual(t.$.rows.all(),changed);if(kind==='rekey'){assert.equal(t.$.rows.byId('0'),undefined);assert.equal(t.$.rows.byIdOrFail('renamed').n(),0);}
  StructuralStore.prototype.activeKeysSnapshot=function(...args){const keys=original.apply(this,args);if(measured)calls.push({length:keys.length,stack:new Error().stack?.split('\n').slice(1,7)});return keys;};
  let error;measured=true;try{pending[settlement]();}catch(e){error=String(e);}measured=false;
  assert.equal(error,undefined);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),0);
  const expected=settlement==='rollback'?seed:changed,meta=settlement==='rollback'?{}:{n:1};
  assert.deepEqual(t.$.meta(),meta);assert.deepEqual(t.$.rows.all(),expected);pending[settlement]();assert.deepEqual(t.$.meta(),meta);assert.deepEqual(t.$.rows.all(),expected);
  if(kind==='rekey'){assert.equal(t.$.rows.byId(settlement==='rollback'?'renamed':'0'),undefined);assert.equal(t.$.rows.byIdOrFail(settlement==='rollback'?'0':'renamed').n(),0);}
  result.runs.push({N,kind,settlement,calls,error});
 }finally{StructuralStore.prototype.activeKeysSnapshot=original;t.destroy();}
}
console.log(JSON.stringify(result,null,2));
if(result.control==='baseline-work')for(const run of result.runs){const expected=run.settlement==='confirm'?0:run.kind==='add'?0:run.kind==='remove'?2:0;assert.equal(run.calls.length,expected,'optional leaf presence plus one structural operation must retain baseline inventory count');}
