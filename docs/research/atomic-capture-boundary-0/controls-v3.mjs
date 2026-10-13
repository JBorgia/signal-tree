import assert from 'node:assert/strict';
import {watchEffect} from 'vue';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {onTreeError} from '@proof/packages/kernel/src/lib/internals/error-reporter.ts';
import {getPathNotifier} from '@proof/packages/kernel/src/lib/path-notifier.ts';
const mode=process.argv[2], marker=Error('entity capture failed'), prep=Error('entity preparation failed');
const trace={mode,hits:0,prepareHits:0,seen:[],reports:[],checks:[]};let tree,armed=true,stop,phase='setup';
const attempt=fn=>{try{return {threw:false,value:fn()};}catch(error){return {threw:true,error};}};
const check=(name,fn)=>{try{fn();trace.checks.push({name,pass:true});}catch(e){trace.checks.push({name,pass:false,error:String(e)});process.exitCode=1;}};
const base=createVueObservationAdapter();const off=onTreeError(e=>trace.reports.push({operation:e.operation,marker:e.error===marker}));
const fault=!['control','prepare-error','prepare-reentry'].includes(mode);
globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&fault&&subjects?.length&&next?.v===1){trace.hits++;throw marker;}};
globalThis.__entityPrepareProbe=()=>{if(armed&&mode.startsWith('prepare-')&&!trace.prepareHits){trace.prepareHits++;if(mode==='prepare-error')throw prep;tree.$.rows.updateOne('A',{v:7});}};
const pair=()=>[tree.$.scalar(),tree.$.rows.byId('A')?.()?.v ?? null];
const state=()=>({pair:pair(),sibling:tree.$.rows.byId('A')?.()?.s ?? null,pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()});
try{
 tree=createSignalTreeFactory(base)({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});tree.$.rows.addOne({id:'A',v:0,s:0});
 stop=watchEffect(()=>trace.seen.push({phase,pair:pair()}),{flush:'sync'});phase='authored';
 const invocation=attempt(()=>tree.transact(()=>{
   tree.$.scalar.set(1);
   if(mode==='replace')tree.$.rows.replaceOne('A',{id:'A',v:1,s:0});
   else if(mode==='prepare-reentry') {const write=attempt(()=>tree.$.rows.updateOne('A',{v:1}));trace.outerWrite={threw:write.threw,after:pair()};}
   else tree.$.rows.updateOne('A',{v:1});
   if(mode==='repeat'){getPathNotifier().flushSync();tree.$.rows.updateOne('A',{v:2});}
 }));
 trace.invocation={threw:invocation.threw,marker:invocation.error===marker,prepareMarker:invocation.error===prep,code:invocation.error?.code,state:state()};
 if(invocation.threw){
  check('preinstallation rejection preserves exact primary and removes prefix',()=>{assert.ok(invocation.error===marker||invocation.error===prep);assert.deepEqual(state(),{pair:[0,0],sibling:0,pending:0});});
 }else{
  const h=invocation.value;
  if(mode==='sibling'){armed=false;tree.$.rows.updateOne('A',{s:9});getPathNotifier().flushSync();}
  if(mode==='lifetime'){armed=false;tree.$.rows.removeOne('A');tree.$.rows.addOne({id:'A',v:9,s:9});getPathNotifier().flushSync();}
  if(mode==='retry'||mode==='confirm-retry'){
   phase='failed-settlement';const fail=attempt(()=>mode==='retry'?h.rollback():h.confirm());
   trace.failed={threw:fail.threw,code:fail.error?.code,state:state()};
   // A completed decision is also legal; it must be complete. A refusal changes nothing.
   check('first decision is complete or retains unchanged responsibility',()=>{if(fail.threw){assert.deepEqual(state(),{pair:[1,1],sibling:0,pending:1});assert.equal(fail.error?.code,'SIGNALTREE_ROLLBACK_FAILED');}else {assert.deepEqual(pair(),mode==='retry'?[0,0]:[1,1]);assert.equal(state().pending,0);}});
  }
  armed=false;phase='settlement';
  const settled=attempt(()=>mode.startsWith('confirm')?h.confirm():h.rollback());trace.settled={threw:settled.threw,code:settled.error?.code,state:state()};
  const expected=mode.startsWith('confirm')?[1,1]:mode==='lifetime'?[0,9]:[0,0];
  check('actual settlement handles all contributions and preserves surviving truth',()=>{assert.equal(settled.threw,false);assert.deepEqual(pair(),expected);assert.equal(state().pending,0);assert.equal(state().sibling,['sibling','lifetime'].includes(mode)?9:0);});
  const again=attempt(()=>mode.startsWith('confirm')?h.confirm():h.rollback());trace.retry={threw:again.threw,state:state()};
  check('terminal retry is defined and non-mutating',()=>{assert.equal(again.threw,false);assert.deepEqual(pair(),expected);});
  check('settlement publication contains no half-state',()=>{const legal=mode==='lifetime'?['1,9','0,9']:mode==='prepare-reentry'?['1,7','0,0']:mode==='repeat'?['1,2','0,0']:['1,1','0,0'];for(const e of trace.seen.filter(e=>e.phase==='settlement'))assert.ok(legal.includes(e.pair.join(',')),JSON.stringify(e));});
  if(mode==='prepare-reentry')check('valid reentry survives stale outer preparation',()=>{assert.equal(trace.prepareHits,1);assert.equal(trace.outerWrite.threw,true);assert.deepEqual(trace.outerWrite.after,[1,7]);});
 }
 armed=false;phase='next';const next=tree.transact(()=>{tree.$.scalar.set(3);tree.$.rows.updateOne('A',{v:3});});next.confirm();trace.next=state();check('clean later work is usable',()=>{assert.deepEqual(pair(),[3,3]);assert.equal(state().pending,0);});
 if(fault)check('fault actually reached',()=>assert.ok(trace.hits>0));
 if(mode==='prepare-error')check('preparation fault actually reached',()=>assert.equal(trace.prepareHits,1));
}catch(e){trace.fixtureError=e.stack;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;delete globalThis.__entityPrepareProbe;stop?.();off();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
