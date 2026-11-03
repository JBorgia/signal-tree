import assert from 'node:assert/strict';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope,scheduleDurableConsequence} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';
const mode=process.argv[2],trace={mode,hits:0,durable:[]},marker=Error('capture');let tree,armed=true;
const attempt=fn=>{try{return{threw:false,value:fn()};}catch(error){return{threw:true,error};}};
const pair=()=>[tree.$.scalar(),tree.$.rows.byId('A')?.()?.v ?? null];
const state=()=>({pair:pair(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount(),scope:hasOpenCommitScope(tree),durable:trace.durable.slice()});
globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&subjects?.length&&next?.v===1){trace.hits++;throw marker;}};
const base=createVueObservationAdapter();
try{tree=createSignalTreeFactory(base)({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});tree.$.rows.addOne({id:'A',v:0});
const h=tree.transact(()=>{tree.$.scalar.set(1);tree.$.rows.updateOne('A',{v:1});scheduleDurableConsequence({claimant:tree,key:'probe',run:()=>trace.durable.push(pair())});});
assert.ok(trace.hits);trace.before=state();assert.deepEqual(trace.before,{pair:[1,1],pending:1,scope:true,durable:[]});
if(mode==='lifetime'){armed=false;tree.$.rows.removeOne('A');tree.$.rows.addOne({id:'A',v:9});}
const first=attempt(()=>mode==='confirm'?h.confirm():h.rollback());trace.first={threw:first.threw,code:first.error?.code,cause:first.error?.cause?.kind,state:state()};
if(first.threw){assert.equal(first.error?.code,'SIGNALTREE_ROLLBACK_FAILED');assert.deepEqual(state(),{pair:mode==='lifetime'?[1,9]:[1,1],pending:1,scope:true,durable:[]});}
else{assert.deepEqual(state(),{pair:mode==='confirm'?[1,1]:mode==='lifetime'?[0,9]:[0,0],pending:0,scope:false,durable:mode==='confirm'?[[1,1]]:[]});}
armed=false;
if(mode==='lifetime'&&first.threw)h.confirm();else if(mode==='confirm')h.confirm();else h.rollback();
trace.after=state();assert.equal(trace.after.pending,0);assert.equal(trace.after.scope,false);
assert.deepEqual(trace.after.pair,mode==='lifetime'?(first.threw?[1,9]:[0,9]):mode==='confirm'?[1,1]:[0,0]);
assert.deepEqual(trace.durable,mode==='confirm'?[[1,1]]:mode==='lifetime'&&first.threw?[[1,9]]:[]);trace.status='pass';
}catch(error){trace.status='fail';trace.error=error.stack;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
