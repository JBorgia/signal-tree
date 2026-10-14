import assert from 'node:assert/strict';
import {entityMap,signalTree,transactions,restoration,undoable} from '@signal-tree/kernel';
import {getPathNotifier} from '@proof/packages/kernel/src/lib/path-notifier.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
assert.equal(process.argv[2]??'suite','suite');
const output={faultInjection:false,source:'restoration-missing-anchors.spec.ts',results:[]};
for(const multiple of [false,true]) for(const reverse of [false,true]) for(const unrelated of [false,true]) {
 const r={multiple,reverse,unrelated};output.results.push(r);
 const tree=signalTree({scalar:0,rows:entityMap()},{enhancers:reverse?[transactions(),restoration()]:[restoration(),transactions()]});
 const stops=[];
 try {
 const rows=tree.$.rows;rows.addMany((multiple?['a','b','c','d','e']:['a','b','c']).map(id=>({id})));getPathNotifier().flushSync();
 const pending=tree.transact(()=>undoable(()=>{tree.$.scalar(1);rows.removeOne('b');if(multiple)rows.removeOne('d');}));
 undoable(()=>{for(const id of multiple?['a','c','e']:['a','c'])rows.removeOne(id);if(unrelated)rows.addOne({id:'z'});});getPathNotifier().flushSync();
 const runtime=peekInternalTransactionRuntime(tree),ids=runtime.getPendingTurnIds(),confirmed=runtime.getConfirmedTurnCount(),before=tree.$(),publications=[];
 assert.equal(ids.length,1);assert.equal(runtime.describePendingTurn(ids[0]).effects.filter(e=>e.kind==='remove').length,multiple?2:1);
 assert.deepEqual(rows.ids(),unrelated?['z']:[]);assert.equal(tree.$.scalar(),1);
 stops.push(getPathNotifier().subscribe('**',()=>publications.push(tree.$())),tree.$.scalar.subscribe(()=>publications.push(tree.$())));
 for(let attempt=0;attempt<2;attempt++){
  assert.throws(()=>pending.rollback(),/no live placement anchor/);assert.deepEqual(tree.$(),before);assert.deepEqual(runtime.getPendingTurnIds(),ids);assert.equal(runtime.getConfirmedTurnCount(),confirmed);assert.deepEqual(publications,[]);getPathNotifier().flushSync();assert.deepEqual(publications,[]);
 }
 pending.confirm();assert.equal(runtime.getPendingTurnCount(),0);assert.deepEqual(tree.$(),before);r.status='pass';
 }catch(error){r.status='fail';r.error=error.stack;process.exitCode=1;}finally{for(const stop of stops)stop();tree.destroy();getPathNotifier().flushSync();}
}
console.log(JSON.stringify(output,null,2));
