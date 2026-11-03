import assert from 'node:assert/strict';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap, transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {onTreeError} from '@proof/packages/kernel/src/lib/internals/error-reporter.ts';
const mode=process.argv[2], marker=mode.endsWith('undefined')?undefined:Error('entity capture failed');
const trace={mode,hits:0,reports:[],checks:[]}; let tree,armed=false;
const attempt=fn=>{try{return {threw:false,value:fn()};}catch(error){return {threw:true,error};}};
const check=(name,fn)=>{try{fn();trace.checks.push({name,pass:true});}catch(e){trace.checks.push({name,pass:false,error:String(e)});process.exitCode=1;}};
const base=createVueObservationAdapter();const off=onTreeError(e=>trace.reports.push({operation:e.operation,marker:e.error===marker}));
globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&mode.startsWith('capture')&&subjects?.length&&next?.v===1){trace.hits++;throw marker;}};
const state=()=>({pair:[tree.$.scalar(),tree.$.rows.byIdOrFail('A')().v],pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()});
try{
 tree=createSignalTreeFactory(base)({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});
 tree.$.rows.addOne({id:'A',v:0}); armed=true;
 const h=tree.transact(()=>{tree.$.scalar.set(1);tree.$.rows.updateOne('A',{v:1});});
 trace.afterWrite=state();const inspection=attempt(()=>h.inspect());trace.inspection={threw:inspection.threw,value:inspection.value,code:inspection.error?.code};
 const first=attempt(()=>h.rollback());trace.first={threw:first.threw,marker:first.error===marker,code:first.error?.code,state:state()};
 armed=false;
 const retry=attempt(()=>h.rollback());trace.retry={threw:retry.threw,code:retry.error?.code,state:state()};
 check('capture injection is reached',()=>assert.equal(trace.hits>0,mode.startsWith('capture')));
 check('rollback succeeds completely or honestly retains responsibility',()=>{if(!first.threw){assert.deepEqual(trace.first.state.pair,[0,0]);assert.equal(trace.first.state.pending,0);}else assert.equal(trace.first.state.pending,1);});
 check('retry cannot falsely succeed',()=>{if(!retry.threw)assert.deepEqual(trace.retry.state.pair,[0,0]);});
 const next=tree.transact(()=>{tree.$.scalar.set(2);tree.$.rows.updateOne('A',{v:2});});next.confirm();trace.next=state();check('independent later progress',()=>assert.deepEqual(trace.next,{pair:[2,2],pending:0}));
}catch(e){trace.fixtureError=e.stack;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;off();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
