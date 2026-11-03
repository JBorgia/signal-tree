import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
const tree=signalTree({scalar:0,rows:entityMap({selectId:row=>row[0]})},{enhancers:[transactions()]});
const trace={};
try {
 tree.$.rows.addOne(['A',0]);
 const state=()=>({scalar:tree.$.scalar(),rows:tree.$.rows.all(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()});
 trace.initial=state();
 const pending=tree.transact(()=>{tree.$.scalar(1);tree.$.rows.replaceOne('A',['A',1]);});
 trace.speculative=state();assert.equal(trace.speculative.scalar,1);assert.equal(trace.speculative.pending,1);assert.deepEqual(trace.speculative.rows,[['A',1]]);
 try{pending.rollback();trace.rollback={threw:false};}catch(e){trace.rollback={threw:true,message:e.message,code:e.code};}
 trace.after=state();assert.equal(trace.rollback.threw,false);assert.deepEqual(trace.after,trace.initial);pending.rollback();assert.deepEqual(state(),trace.initial);trace.status='pass';
}catch(e){trace.status='fail';trace.error=e.stack;process.exitCode=1;}finally{tree.destroy();}
console.log(JSON.stringify(trace,null,2));
