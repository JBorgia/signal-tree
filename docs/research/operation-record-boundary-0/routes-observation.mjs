import assert from 'node:assert/strict';
import {watchEffect} from 'vue';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createVueObservationAdapter} from '@proof/packages/vue/src/lib/vue-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
const mode=process.argv[2], trace={mode,hits:0,seen:[]}, marker=Error('capture');let armed=false,tree,phase='setup',stop;
const attempt=fn=>{try{return{threw:false,value:fn()};}catch(error){return{threw:true,code:error?.code,message:String(error)}}};
const rows=()=>tree.$.rows.all().map(x=>({...x}));const state=()=>({scalar:tree.$.scalar(),rows:rows(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()});
globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&subjects?.length){trace.hits++;throw marker;}};
const base=createVueObservationAdapter();
try{
 tree=createSignalTreeFactory(base)({scalar:0,rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});tree.$.rows.addMany([{id:'A',v:0,s:5},{id:'B',v:0,s:6},{id:'C',v:0,s:7}]);const initial=rows();
 stop=watchEffect(()=>trace.seen.push({phase,scalar:tree.$.scalar(),rows:rows(),physical:tree.$.rows.__prepareTransitionTarget.readSource().subjects.map(s=>({...s.value})),direct:['A','B','C','D','E'].map(id=>tree.$.rows.byId(id)?.()).filter(Boolean).map(r=>({...r}))}),{flush:'sync'});
 armed=!mode.endsWith('-control');const route=mode.replace('-control','');phase='authored';
 const h=tree.transact(()=>{tree.$.scalar.set(1);const r=tree.$.rows;
  if(route==='update')r.updateOne('A',{v:1});
  else if(route==='replace')r.replaceOne('A',{id:'A',v:1});
  else if(route==='add')r.addOne({id:'D',v:1});
  else if(route==='remove')r.removeOne('A');
  else if(route==='remove-many')r.removeMany(['A','B']);
  else if(route==='upsert')r.upsertMany([{id:'A',v:1},{id:'D',v:1}]);
  else if(route==='clear')r.clear();
  else if(route==='set-all')r.setAll([{id:'A',v:1},{id:'D',v:1}]);
  else if(route==='repeat'){r.updateOne('A',{v:1});r.updateOne('A',{v:2});}
  else if(route==='add-remove'){r.addOne({id:'D',v:1});r.removeOne('D');}
  else if(route==='add-update'){r.addOne({id:'D',v:1});r.updateOne('D',{v:2});}
  else if(route==='remove-readd'){r.removeOne('A');r.addOne({id:'A',v:1});}
  else if(route==='prepend')r.prependMany([{id:'D',v:1},{id:'E',v:1}]);
  else throw Error('unknown route');
 });trace.authored=state();assert.equal(trace.authored.scalar,1);if(armed)assert.ok(trace.hits>0);armed=false;phase='settlement';
 trace.first=attempt(()=>h.rollback());trace.after=state();assert.equal(trace.first.threw,false);assert.deepEqual(trace.after,{scalar:0,rows:initial,pending:0});
 trace.retry=attempt(()=>h.rollback());assert.equal(trace.retry.threw,false);assert.deepEqual(state(),trace.after);
 for(const event of trace.seen.filter(x=>x.phase==='settlement'))assert.deepEqual({scalar:event.scalar,rows:event.rows},{scalar:0,rows:initial});
 phase='confirmation';const next=tree.transact(()=>tree.$.scalar.set(2));next.confirm();assert.equal(state().scalar,2);assert.equal(state().pending,0);trace.status='pass';
}catch(e){trace.status='fail';trace.error=e.stack;trace.final=tree?state():undefined;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;stop?.();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
