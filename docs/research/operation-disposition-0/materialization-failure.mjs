import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
const marker=Error('controlled disposition normalization failure');let hits=0,handle,error;
const tree=signalTree({n:0,rows:entityMap()},{enhancers:[transactions()]});
try{
 tree.$.rows.addOne({id:'a',n:0});
 globalThis.__normalizationFault=()=>{hits++;throw marker;};
 try{handle=tree.transact(()=>{tree.$.n(1);tree.$.rows.updateOne('a',{n:1});});}catch(e){error=e;}
 delete globalThis.__normalizationFault;
 const state={scalar:tree.$.n(),row:tree.$.rows.byIdOrFail('a').n(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount(),handleReturned:!!handle,exactFailure:error===marker};
 console.log(JSON.stringify({faultInjection:true,hits,state},null,2));
 assert.equal(hits,1);
 assert.ok(state.pending>0 || (state.scalar===0&&state.row===0),'failed normalization must not orphan installed speculative writes');
}finally{delete globalThis.__normalizationFault;tree.destroy();}
