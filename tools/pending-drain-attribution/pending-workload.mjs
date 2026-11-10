import assert from 'node:assert/strict';
export async function pendingWorkload(dir,variant,ownersPerTree){
 const rowCount=1000,treeCount=10,fixedPrimeCount=32;
const {signalTree,entityMap,transactions}=await import(dir+'/index.js');
const {peekInternalTransactionRuntime}=await import(dir+'/enhancers/transactions/transactions.js');
const pending=t=>peekInternalTransactionRuntime(t).getPendingTurnCount();
function createHeld(){const held=[];for(let j=0;j<treeCount;j++){
 const t=signalTree({fields:Object.fromEntries(Array.from({length:16},(_,i)=>['f'+i,0])),rows:entityMap()},{enhancers:[transactions()]});t.$.rows.setAll(Array.from({length:rowCount},(_,i)=>({id:String(i),name:'row'+i,value:0})));
 const primed=[];for(let k=0;k<(variant==='anchor'?ownersPerTree:fixedPrimeCount);k++){const row=t.$.rows.byIdOrFail(String(k));assert.equal(row().value,0);if(variant!=='anchor')primed.push(row);}
 if(variant!=='anchor')primed.push(t.$.rows.byIdOrFail('999'));
 assert.equal(t.$.rows.count(),rowCount);assert.equal(pending(t),0);held.push(variant==='anchor'?{t,owners:[]}:{t,owners:[],primed});
 }return held;}
function author(held){for(const h of held){for(let k=0;k<ownersPerTree;k++)h.owners.push(h.t.transact(()=>h.t.$.rows.updateOne(variant==='fixed-same'?'0':String(k),{value:variant==='fixed-same'?k+1:1})));assert.equal(pending(h.t),ownersPerTree);if(variant==='fixed-same'){assert.equal(h.t.$.rows.byIdOrFail('0')().value,ownersPerTree);}else for(let k=0;k<ownersPerTree;k++)assert.equal(h.t.$.rows.byIdOrFail(String(k))().value,1);if(variant!=='anchor')assert.equal(h.t.$.rows.byIdOrFail('999')().value,0);}}
function settle(held,mode){for(const h of held){if(mode==='confirmed'){for(const owner of h.owners)owner.confirm();}else if(variant==='fixed-same'){for(let k=h.owners.length-1;k>=0;k--){h.owners[k].rollback();assert.equal(h.t.$.rows.byIdOrFail('0')().value,k);}}else for(const owner of h.owners)owner.rollback();h.owners=[];assert.equal(pending(h.t),0);const expected=mode==='confirmed'?1:0;if(variant==='fixed-same')assert.equal(h.t.$.rows.byIdOrFail('0')().value,mode==='confirmed'?ownersPerTree:0);else for(let k=0;k<ownersPerTree;k++)assert.equal(h.t.$.rows.byIdOrFail(String(k))().value,expected);}}
function destroy(held){for(const h of held)h.t.destroy();}

return {createHeld,author,settle,destroy,pending};
}
