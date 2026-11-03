import assert from 'node:assert/strict';
import {entityMap,signalTree,transactions,restoration,undoable} from '@signal-tree/kernel';
import {getPathNotifier} from '@proof/packages/kernel/src/lib/path-notifier.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
assert.equal(process.argv[2]??'suite','suite');
const output={faultInjection:false,results:[]};
for(const mode of ['remove-before','remove-after','rekey-before','rekey-after','removed-recorded-anchor']) {
 const r={mode};output.results.push(r);
 const tree=signalTree({scalar:0,rows:entityMap()},{enhancers:[restoration(),transactions()]});const rows=tree.$.rows;
 try {
 rows.addMany(['a','b','c'].map(id=>({id})));getPathNotifier().flushSync();
 const restored=mode==='removed-recorded-anchor'?'c':'b',held=rows.byIdOrFail(restored);
 const pending=tree.transact(()=>undoable(()=>{
  tree.$.scalar(1);
  if(mode==='remove-before'||mode==='removed-recorded-anchor') rows.addOne({id:'n'});
  if(mode==='rekey-before') rows.changeId('c','x');
  rows.removeOne(restored);
  if(mode==='remove-after') rows.addOne({id:'n'});
  if(mode==='rekey-after') rows.changeId('c','x');
 }));
 const runtime=peekInternalTransactionRuntime(tree);
 const state=()=>({scalar:tree.$.scalar(),ids:[...rows.ids()],pending:runtime.getPendingTurnCount(),held:held()});
 r.speculative=state();assert.equal(r.speculative.scalar,1);assert.equal(r.speculative.pending,1);assert.equal(held(),undefined);
 const external=mode==='removed-recorded-anchor'?['n','b','a']:mode.startsWith('rekey')?['x','a']:['c','a','n'];
 rows.setAll(external.map(id=>({id})));
 r.before=state();
 try {pending.rollback();r.rollback={threw:false};}catch(error){r.rollback={threw:true,message:error?.message,code:error?.code};}
 r.after=state();
 if(mode==='removed-recorded-anchor') {
  assert.equal(r.rollback.threw,true); assert.equal(r.rollback.code,'SIGNALTREE_ROLLBACK_FAILED');
  assert.match(r.rollback.message,/later-confirmed-dependency/); assert.deepEqual(r.after,r.before);
  assert.throws(()=>pending.rollback(),error=>error?.code==='SIGNALTREE_ROLLBACK_FAILED');
  assert.deepEqual(state(),r.before); r.status='pass'; continue;
 }
 assert.equal(r.rollback.threw,false);
 // External setAll authors newer key truth in the rekey-after history.
 const expected=mode==='rekey-after'?['b','x','a']:['b','c','a'];
 assert.deepEqual(r.after.ids,expected);assert.equal(r.after.scalar,0);assert.equal(r.after.pending,0);assert.equal(rows.byIdOrFail(restored),held);assert.deepEqual(held(),{id:restored});
 pending.rollback();assert.deepEqual(state(),r.after);r.status='pass';
 } catch(error){r.status='fail';r.error=error.stack;process.exitCode=1;} finally{tree.destroy();}
}
console.log(JSON.stringify(output,null,2));
