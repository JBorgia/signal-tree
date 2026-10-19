import assert from 'node:assert/strict';
const {signalTree,transactions,SignalTreeRollbackError}=await import('/private/tmp/st-new-key-cost-20261018/shared/dist/packages/kernel/dist/index.js');
const tree=signalTree({count:0},{enhancers:[transactions()]});
try{
 const older=tree.transact(()=>tree.$.count(1));
 const newer=tree.transact(()=>tree.$.count(2));
 assert.throws(()=>older.rollback(),e=>e instanceof SignalTreeRollbackError && e.cause.kind==='later-confirmed-dependency');
 assert.equal(tree.$.count(),2);
 newer.rollback();assert.equal(tree.$.count(),1);
 older.rollback();assert.equal(tree.$.count(),0);
 older.rollback();assert.equal(tree.$.count(),0);
 console.log(JSON.stringify({initial:0,afterRefusal:2,afterNewerRollback:1,afterOlderRetry:0,repeatedRollback:0}));
}finally{tree.destroy();}
