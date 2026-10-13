import assert from 'node:assert/strict';
import{createSignalTreeFactory}from'@signal-tree/kernel/adapter';import{entityMap,transactions}from'@signal-tree/kernel';import{createVueObservationAdapter}from'@proof/packages/vue/src/lib/vue-observation.ts';import{peekInternalTransactionRuntime}from'@proof/packages/kernel/src/enhancers/transactions/transactions.ts';import{getPathNotifier}from'@proof/packages/kernel/src/lib/path-notifier.ts';
const mode=process.argv[2],trace={mode,hits:0},marker=Error('capture');let armed=false,tree;const base=createVueObservationAdapter();
globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&subjects?.length){trace.hits++;throw marker;}};
try{tree=createSignalTreeFactory(base)({scalar:0,group:{rows:entityMap({selectId:r=>r.id})}},{enhancers:[transactions()]});const rows=tree.$.group.rows;rows.addOne({id:'A',v:0});tree.$({scalar:0});getPathNotifier().flushSync();assert.deepEqual(rows.all(),[]);armed=mode==='fault';
const h=tree.transact(()=>{tree.$.scalar.set(1);rows.addOne({id:'B',v:1});});trace.write={snapshot:tree.$(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()};armed=false;
try{h.rollback();trace.rollback={threw:false};}catch(e){trace.rollback={threw:true,code:e.code,message:String(e)};}
trace.after={snapshot:tree.$(),rows:rows.all(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()};assert.equal(trace.rollback.threw,false);assert.deepEqual(trace.after,{snapshot:{scalar:0},rows:[],pending:0});h.rollback();trace.status='pass';
}catch(e){trace.status='fail';trace.error=e.stack;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;tree?.destroy();base.dispose?.();}console.log(JSON.stringify(trace,null,2));
