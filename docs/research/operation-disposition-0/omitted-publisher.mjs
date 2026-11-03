import assert from 'node:assert/strict';
import {createRoot,createMemo,createComputed} from 'solid-js';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';import {entityMap,transactions} from '@signal-tree/kernel';
import {createSolidObservationAdapter} from '@proof/packages/solid/src/lib/solid-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';
const mode=process.argv[2], fault=Error('after real token invalidate'), trace={mode,faultModel:'original writable-token publication fault; no new internal fault',seen:[],hits:0};let armed=false,t,dispose;
const base=createSolidObservationAdapter();const adapter={...base,createWritableCell(read){const r=base.createWritableCell(read);return {...r,token:{observe:()=>r.token.observe(),invalidate(){r.token.invalidate();if(armed&&trace.hits===0){trace.hits++;trace.faultStack=new Error().stack;throw fault;}}}};}};
const attempt=fn=>{try{fn();return {threw:false};}catch(e){return {threw:true,sameFault:e===fault,message:e?.message,code:e?.code};}};
try{
 t=createSignalTreeFactory(adapter)({scalar:0,a:{keep:0,rows:entityMap()}},{enhancers:[transactions()]});t.$.a.rows.addOne({id:'A',v:0});const held=t.$.a.rows.byIdOrFail('A');held();
 const omit=()=>mode.includes('collection')?t.$.a({keep:0}):t.$({scalar:t.$.scalar()});
 if(mode.includes('before'))omit();
 const state=()=>({scalar:t.$.scalar(),rows:t.$.a.rows.all().map(r=>[r.id,r.v]),held:held()?.v??null});
 const snap=()=>({...state(),rootKeys:Object.keys(t.$()),freshRow:t.$.a.rows.byId('A')?.()?.v??null,pending:peekInternalTransactionRuntime(t).getPendingTurnCount(),scope:hasOpenCommitScope(t)});
 trace.before=state();
 dispose=createRoot(off=>{const s=createMemo(()=>t.$.scalar()),r=createMemo(()=>t.$.a.rows.all().map(r=>[r.id,r.v]));createComputed(()=>trace.seen.push({scalar:s(),rows:r()}));return off;});
 const pending=t.transact(()=>{t.$.scalar.set(1);if(mode.includes('before'))t.$.a.rows.addOne({id:'B',v:1});else{t.$.a.rows.updateOne('A',{v:1});omit();}});
 trace.pending=snap();armed=!mode.includes('control');trace.rollback=attempt(()=>pending.rollback());trace.after=snap();armed=false;trace.retry=attempt(()=>pending.rollback());trace.afterRetry=snap();
 if(!mode.includes('control')){assert.equal(trace.hits,1);assert.equal(trace.rollback.sameFault,true);}else assert.equal(trace.rollback.threw,false);
 assert.deepEqual(state(),trace.before);assert.deepEqual({scalar:trace.after.scalar,rows:trace.after.rows,held:trace.after.held},trace.before);assert.equal(trace.after.pending,0);assert.equal(trace.after.scope,false);assert.equal(trace.retry.threw,false);trace.status='pass';
}catch(e){trace.status='fail';trace.error=e.stack;process.exitCode=1;}finally{armed=false;dispose?.();t?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
