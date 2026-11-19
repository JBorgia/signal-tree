import assert from 'node:assert/strict';
import { signalTree, transactions, external, link } from '@signal-tree/kernel';
import { activeTransactionContext, treeRuntimeId, withWriteObservationScope, observeWrites, transactionLifecycleReader, linkStateReader } from '@signal-tree/kernel/internals';
const results: any[] = [];
async function check(name: string, fn: () => any) {
 try { results.push({name, outcome:'PASS', evidence:await fn()}); }
 catch(error) {results.push({name,outcome:'FAIL',error:String(error),stack:(error as Error).stack});}
}
const tick = async () => {for(let i=0;i<8;i++) await Promise.resolve();};
await check('operation correlation through public tooling seam', async () => {
 const tree=signalTree({capacity:10,requested:0},{enhancers:[transactions()]});
 const frames:any[]=[]; const events:any[]=[]; let context:any;
 const off=observeWrites(f=>{if(f.ownerId===treeRuntimeId(tree))frames.push(f);});
 const life=transactionLifecycleReader(tree)!; const unsub=life.subscribe(e=>events.push(e));
 try {
 const pending=tree.transact(()=>withWriteObservationScope(treeRuntimeId(tree)!, 'operation-1',()=>{context=activeTransactionContext();tree.$.requested(7);}));
 await tick(); assert.ok(context); assert.equal(activeTransactionContext(),undefined);
 assert.ok(frames.some(f=>f.declaredScopes?.tokens.includes('operation-1') && f.transactionId===context.id));
 pending.confirm(); assert.ok(events.some(e=>e.kind==='confirmed' && e.transactionId===context.id));
 return {transactionId:context.id,scopes:frames.map(f=>f.declaredScopes),lifecycle:events.map(e=>e.kind)};
 } finally {off();unsub();tree.destroy();}
});
await check('inspect equality does not bind reviewed input or block confirm', () => {
 const tree=signalTree({capacity:10,requested:0},{enhancers:[transactions()]});
 try {
 const pending=tree.transact(()=>tree.$.requested(Math.min(7,tree.$.capacity()))); const reviewed=pending.inspect();
 external(()=>tree.$.capacity(5)); const after=pending.inspect();
 assert.deepEqual(after,reviewed); pending.confirm();
 assert.equal(tree.$.requested(),7); assert.equal(tree.$.capacity(),5);
 return {reviewed,after,confirmed:true,invalidDomainState:tree.$.requested()>tree.$.capacity()};
 } finally {tree.destroy();}
});
await check('bounded companion rejects stale review and accepts fresh review', () => {
 const tree=signalTree({capacity:10,requested:0,note:''},{enhancers:[transactions()]});
 try {
 const pending=tree.transact(()=>tree.$.requested(Math.min(7,tree.$.capacity())));
 const review=()=>Object.freeze({operationId:'op-2',capacity:tree.$.capacity(),requested:tree.$.requested(),inspection:JSON.stringify(pending.inspect())});
 const approve=(r:ReturnType<typeof review>)=>{
  // No await, external callback, or approval UI between these reads and confirm.
  if(r.capacity!==tree.$.capacity() || r.requested!==tree.$.requested() || r.inspection!==JSON.stringify(pending.inspect()))return 'stale';
  if(r.requested>r.capacity)return 'invalid';
  pending.confirm(); return 'confirmed';
 };
 const old=review(); external(()=>tree.$.capacity(5)); assert.equal(approve(old),'stale');
 assert.equal(transactionLifecycleReader(tree)!.snapshot().pending.length,1);
 assert.equal(approve(review()),'invalid');
 external(()=>tree.$.capacity(12)); const fresh=review(); tree.$.note('independent');
 assert.equal(approve(fresh),'confirmed');
 return {old:'stale',refreshedInvalid:'invalid',fresh:'confirmed',unrelatedNotePreserved:tree.$.note()};
 } finally {tree.destroy();}
});
await check('external dependency ABA is absent from inspection and value snapshot', () => {
 const tree=signalTree({capacity:10,requested:0},{enhancers:[transactions()]});
 try {
 const pending=tree.transact(()=>tree.$.requested(Math.min(7,tree.$.capacity()))); const before={capacity:tree.$.capacity(),inspection:pending.inspect()};
 external(()=>tree.$.capacity(5)); external(()=>tree.$.capacity(10));
 const after={capacity:tree.$.capacity(),inspection:pending.inspect()}; assert.deepEqual(after,before);
 pending.rollback(); return {before,after,historySensitiveApprovalNotEstablished:true};
 } finally {tree.destroy();}
});
await check('Link settled resolves after endpoint failure', async () => {
 const tree=signalTree({x:0},{enhancers:[transactions()]}); const events:any[]=[];let calls=0;
 const reader=linkStateReader(tree);const off=reader.subscribe(e=>events.push(e.kind));
 const connection=link(tree.$.x,{set:async()=>{calls++;throw new Error('synthetic endpoint failure');}});
 try {const p=tree.transact(()=>tree.$.x(1));p.confirm();await connection.settled();assert.ok(calls>0);assert.ok(events.includes('send-failed'));return {calls,settledResolved:true,events};}
 finally {connection.dispose();off();tree.destroy();}
});
await check('write observation does not provide an input revision for net-zero ABA', async () => {
 const tree=signalTree({capacity:10,requested:0},{enhancers:[transactions()]});
 const frames:any[]=[];const off=observeWrites(f=>{if(f.ownerId===treeRuntimeId(tree))frames.push(f);});
 try {
 const pending=tree.transact(()=>tree.$.requested(Math.min(7,tree.$.capacity())));await tick();frames.length=0;
 const reviewed=pending.inspect();
 external(()=>{tree.$.capacity(5);tree.$.capacity(10);});await tick();
 const capacityFrames=frames.filter(f=>f.path==='capacity');
 assert.equal(capacityFrames.length,0);assert.deepEqual(pending.inspect(),reviewed);
 pending.rollback();return {capacityFrames:capacityFrames.length,inspectionUnchanged:true};
 }finally {off();tree.destroy();}
});
console.log(JSON.stringify({sourceHead:'5727cd8fcf701128358674411400c019b137a5e4',results},null,2));
process.exitCode=results.some(r=>r.outcome==='FAIL')?1:0;
