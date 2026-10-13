import assert from 'node:assert/strict';import {createRoot,createMemo,createComputed} from 'solid-js';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';import {entityMap,transactions} from '@signal-tree/kernel';
import {createSolidObservationAdapter} from '@proof/packages/solid/src/lib/solid-observation.ts';
// Read-only diagnostics; not new facade capabilities or production exports.
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';
const control=process.argv[2],trace={control,seen:[],scalarSeen:[],rowSeen:[],frames:[],faultHits:0,reentryHits:0,snapshots:[]},callback=Error('authored callback'),publish=Error('after real token invalidate');
let armed=false,depth=0,tree,dispose,allowReentry=false;const base=createSolidObservationAdapter();
const adapter={...base,createWritableCell(read){const r=base.createWritableCell(read);return {...r,token:{observe:()=>r.token.observe(),invalidate(){r.token.invalidate();if(armed&&trace.faultHits===0){trace.faultHits++;throw publish;}}}};},runInvalidationGroup(fn){const frame={depth:++depth,returnedNormally:false};trace.frames.push(frame);try{base.runInvalidationGroup(()=>{fn();frame.returnedNormally=true;});}finally{depth--;}}};
function attempt(fn){try{const value=fn();return {threw:false,value};}catch(error){return {threw:true,error};}}
function outcome(r){return {threw:r.threw,callback:r.error===callback,publish:r.error===publish,message:r.error?.message,code:r.error?.code,cause:r.error?.cause?.kind,recovery:r.error?.recovery?{callbackFailed:r.error.recovery.callbackFailed,callbackErrorIsMarker:r.error.recovery.callbackError===callback,inspection:r.error.recovery.transaction.inspect()}:null};}
function snap(label){const s={label,seen:trace.seen.map(x=>[...x]),scalarSeen:[...trace.scalarSeen],rowSeen:[...trace.rowSeen],faultHits:trace.faultHits,reentryHits:trace.reentryHits,frames:trace.frames.map(x=>({...x}))};trace.snapshots.push(s);s.source=[tree.$.scalar(),tree.$.rows.byIdOrFail('A')().v];s.pending=peekInternalTransactionRuntime(tree)?.getPendingTurnCount();s.openScope=hasOpenCommitScope(tree);return s;}
function write(v){tree.$.scalar.set(v);tree.$.rows.updateOne('A',{v});}
try{
 tree=createSignalTreeFactory(adapter)({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});tree.$.rows.addOne({id:'A',v:0});
 dispose=createRoot(off=>{const a=createMemo(()=>tree.$.scalar()),b=createMemo(()=>tree.$.rows.byIdOrFail('A')().v);createComputed(()=>trace.scalarSeen.push(a()));createComputed(()=>trace.rowSeen.push(b()));createComputed(()=>{const pair=[a(),b()];trace.seen.push(pair);if(allowReentry&&pair[0]===1&&pair[1]===1&&!trace.reentryHits){trace.reentryHits++;tree.$.rows.updateOne('A',{v:5});}});return off;});
 assert.deepEqual(trace.seen,[[0,0]]);trace.frames=[];
 if(control==='explicit-rollback-fault'){
  const pending=tree.transact(()=>write(1));const staged=snap('pending-before-rollback');assert.equal(staged.pending,1);assert.deepEqual(staged.source,[1,1]);trace.pendingInspection=pending.inspect();armed=true;
  const r=attempt(()=>pending.rollback());trace.outcome=outcome(r);const s=snap('rollback-return');assert.equal(trace.faultHits,1);assert.equal(r.error,publish);assert.deepEqual(s.source,[0,0]);assert.equal(s.pending,0);assert.equal(s.openScope,false);
 }else{
  allowReentry=control==='callback-refusal';armed=control==='callback-publish-fault'||control==='publish-fault';
  const r=attempt(()=>tree.transact(()=>{write(1);if(control!=='publish-fault')throw callback;}));trace.outcome=outcome(r);const s=snap('transact-return');assert.equal(r.threw,true);
  if(allowReentry){assert.equal(trace.reentryHits,1);assert.equal(r.error?.code,'SIGNALTREE_ROLLBACK_FAILED');assert.equal(r.error.recovery.callbackFailed,true);assert.equal(r.error.recovery.callbackError,callback);assert.deepEqual(s.source,[1,5]);assert.equal(s.pending,1);assert.equal(s.openScope,true);r.error.recovery.transaction.confirm();const settled=snap('explicit-recovery-confirm');assert.equal(settled.pending,0);assert.deepEqual(settled.source,[1,5]);}
  else{assert.equal(r.error,control==='publish-fault'?publish:callback);assert.deepEqual(s.source,[0,0]);assert.equal(s.pending,0);assert.equal(s.openScope,false);if(armed)assert.equal(trace.faultHits,1);}
 }
 // Coherence check excludes legitimate later author pair[1,5]. No native demand.
 const legal=allowReentry?new Set(['0,0','1,1','1,5']):new Set(['0,0','1,1']);for(const pair of trace.seen)assert.ok(legal.has(pair.join(',')),'unexpected mixed pair '+pair);
 armed=false;allowReentry=false;const next=tree.transact(()=>write(2));next.confirm();const after=snap('next-successful-transaction');assert.deepEqual(after.source,[2,2]);assert.equal(after.pending,0);trace.status='pass';
}catch(e){trace.status='fail';trace.error=e.stack;process.exitCode=1;}finally{dispose?.();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
