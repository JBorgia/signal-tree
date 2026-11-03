import assert from 'node:assert/strict';
globalThis.ngDevMode=false;
const {signalTree,transactions}=await import('/private/tmp/st-new-key-cost-20261018/shared/dist/packages/kernel/dist/index.js');
const tree=signalTree({count:1,rows:{}},{enhancers:[transactions()]});
try{
 const pending=tree.transact(()=>tree.$.rows({b:{n:2}}));
 assert.equal(tree.$.rows.b.n(),2);assert.ok(pending.inspect().changes.length>0);
 pending.rollback();assert.deepEqual(tree.$.rows(),{});pending.rollback();
 const failure=new Error('private preparation');
 assert.throws(()=>tree.$({count:2,rows:{bad:{get n(){throw failure;}}}}),e=>e===failure);
 assert.deepEqual(tree.$(),{count:1,rows:{}});
 assert.equal(Object.hasOwn(tree.$.rows,'bad'),false);
 console.log(JSON.stringify({newKeyWrite:true,inspection:true,rollback:true,repeatSettlement:true,preparationFailureAtomic:true}));
}finally{tree.destroy();}
