import assert from 'node:assert/strict';
import {createStore,SignalTreeRollbackError} from './arm-b.mjs';
const variants=()=>[['occupied',Object.defineProperty(new Error('original'),'recovery',{value:'occupied',configurable:false})],['frozen',Object.freeze(new Error('original'))],['undefined',undefined],['null',null],['string','original'],['number',7],['symbol',Symbol('original')]];
for(const [name,original] of variants())for(const fail of [false,true]){
 const s=createStore();s.write('x',0);const row=s.add('A',{n:0});let caught=false,thrown;const abort=new Error('abort');
 try{s.begin(()=>{s.write('x',1);row.write({n:1});if(fail)s.failNextPreparation(abort);throw original;});}catch(e){caught=true;thrown=e;}
 assert.ok(caught);
 if(!fail){assert.ok(Object.is(thrown,original));assert.deepEqual(s.read('x'),{present:true,value:0});assert.deepEqual(row.read(),{n:0});}
 else{
  assert.ok(thrown instanceof SignalTreeRollbackError);assert.equal(thrown.cause,abort);assert.equal(thrown.recovery.callbackFailed,true);assert.ok(Object.is(thrown.recovery.callbackError,original));
  const tx=thrown.recovery.transaction;
  for(let n=0;n<2;n++){const next=new Error('retry');s.failNextPreparation(next);assert.throws(()=>tx.rollback(),e=>e===next);assert.equal(s.stats().retainedOwners,1);assert.deepEqual(s.read('x'),{present:true,value:1});assert.deepEqual(row.read(),{n:1});}
  tx.rollback();assert.deepEqual(s.read('x'),{present:true,value:0});assert.deepEqual(row.read(),{n:0});tx.rollback();assert.deepEqual(row.read(),{n:0});
 }
 assert.equal(s.stats().retainedOwners,0);assert.equal(s.stats().retainedOwnershipLocations,0);assert.deepEqual(s.takeErrors(),[]);s.destroy();console.log(JSON.stringify({name,failedAbort:fail,result:'pass'}));
}
