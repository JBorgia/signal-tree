import assert from 'node:assert/strict';
import {createRoot,createComputed} from 'solid-js';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createSolidObservationAdapter} from '@proof/packages/solid/src/lib/solid-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';

// Public operation shapes from turn-member-images.spec.ts: write/omit/re-add,
// and two path re-adds under one omitted member in either authored order.
// Faults use the existing writable-token seam AFTER its real invalidation.
// Token identities are discovered by actual native cell reads (transparent apply Proxy), never allocation indexes.
const mode=process.argv[2]??'overlap';
const faultTarget=mode.startsWith('fault-')?mode.split('-')[1]:undefined;
const marker=mode.endsWith('-undefined')?undefined:Error('existing native publisher fault');
const trace={mode,faultModel:faultTarget?'throw after real writable token invalidate':'none',seen:[],checks:[],tokens:{scalar:[],member:[],row:[]},hits:0,taps:0};
const physicalReads=new Map();
let label,armed=false,phase='setup',tree,dispose,untap,id=0;
const base=createSolidObservationAdapter();
const adapter={...base,createWritableCell(read){const r=base.createWritableCell(read),tokenId=++id;physicalReads.set(tokenId,read);return {...r,cell:new Proxy(r.cell,{apply(target,self,args){if(label&&!trace.tokens[label].includes(tokenId))trace.tokens[label].push(tokenId);return Reflect.apply(target,self,args);}}),token:{observe(){if(label&&!trace.tokens[label].includes(tokenId))trace.tokens[label].push(tokenId);r.token.observe();},invalidate(){r.token.invalidate();if(armed&&trace.hits===0&&trace.tokens[faultTarget]?.includes(tokenId)){trace.hits++;trace.faultToken=tokenId;trace.faultStack=new Error().stack;throw marker;}}}};}};
const check=(name,fn)=>{try{fn();trace.checks.push({name,pass:true});}catch(e){trace.checks.push({name,pass:false,error:e.stack});process.exitCode=1;}};
const attempt=fn=>{try{fn();return {threw:false};}catch(e){return {threw:true,exact:e===marker,undefined:e===undefined,code:e?.code,message:e?.message};}};
try{
 tree=createSignalTreeFactory(adapter)({count:100,g:{keep:0,h:{x:200,y:undefined}},rows:entityMap()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'A',v:300});rows.setActiveId('A');const held=rows.byIdOrFail('A');
 label='scalar';tree.$.count();label='member';tree.$.g.h.x();label='row';rows.all();held.v();label=undefined;
 const omitH=()=>tree.$.g({keep:0});
 if(mode==='x-first'||mode==='y-first'||faultTarget)omitH();
 const read=()=>({snapshot:tree.$(),rootKeys:Object.keys(tree.$()).sort(),gKeys:Object.keys(tree.$.g()??{}).sort(),hKeys:Object.keys(tree.$.g.h()??{}).sort(),count:tree.$.count(),x:tree.$.g.h.x(),y:tree.$.g.h.y(),ids:[...rows.ids()],all:rows.all().map(r=>({...r})),direct:rows.byIdOrFail('A')().v,held:held().v,activeId:rows.activeId(),active:rows.activeEntity()?.v});
 const capture=()=>structuredClone(read());
 trace.before=capture();
 dispose=createRoot(off=>{createComputed(()=>trace.seen.push({phase,value:capture()}));return off;});
 untap=rows.tap({onUpdate(){if(phase!=='rollback'||mode!=='callback'||trace.taps)return;trace.taps++;tree.$.count.set(777);tree.$.g.h.x.set(777);rows.updateOne('A',{v:777});rows.setActiveId('A');}});
 phase='authored';
 const pending=tree.transact(()=>{
  tree.$.count.set(101);
  if(mode==='overlap'){
   tree.$.g.h.x.set(205);
   tree.$({count:116,rows:rows.all()});
   // Keep unrelated g.keep present: first fixture separately preserves its baseline loss.
   tree.$({g:{keep:0,h:{x:200,y:218}},count:109,rows:rows.all()});
   tree.$.g.h.y.set(213);
  }else if(mode==='y-first'){tree.$.g.h.y.set(215);tree.$.g.h.x.set(203);}
  else if(mode==='x-first'){tree.$.g.h.x.set(203);tree.$.g.h.y.set(215);}
  else {tree.$.g.h.x.set(201);if(mode==='callback')tree.$({count:101,rows:rows.all()});}
  rows.updateOne('A',{v:301});
 });
 trace.speculative=capture();check('useful speculative row and pending authority',()=>{assert.equal(trace.speculative.direct,301);assert.equal(peekInternalTransactionRuntime(tree).getPendingTurnCount(),1);});
 phase='rollback';armed=!!faultTarget;trace.rollback=attempt(()=>pending.rollback());armed=false;trace.after=capture();
 trace.physical={count:physicalReads.get(trace.tokens.scalar[0])(),member:physicalReads.get(trace.tokens.member[0])()};
 trace.pending=peekInternalTransactionRuntime(tree).getPendingTurnCount();trace.scope=hasOpenCommitScope(tree);
 let expected=trace.before;
 if(mode==='callback')expected={...trace.before,snapshot:{...trace.before.snapshot,count:777,g:{...trace.before.snapshot.g,h:{...trace.before.snapshot.g.h,x:777}},rows:{all:[{id:'A',v:777}]}},count:777,x:777,all:[{id:'A',v:777}],direct:777,held:777,active:777};
 check('settlement result and exact first failure',()=>{if(faultTarget){assert.ok(trace.tokens[faultTarget].length);assert.equal(trace.hits,1);assert.equal(trace.rollback.threw,true);assert.equal(trace.rollback.exact,true);}else assert.equal(trace.rollback.threw,false);});
 check('complete visible disposition and retained lifetime',()=>{assert.deepEqual(trace.after,expected);assert.equal(rows.byIdOrFail('A'),held);assert.equal(trace.pending,0);assert.equal(trace.scope,false);if(mode==='callback')assert.equal(trace.taps,1);});
 check('coherent actual settlement delivery',()=>{const seen=trace.seen.filter(e=>e.phase==='rollback');assert.ok(seen.length);for(const event of seen)assert.deepEqual(event.value,expected);});
 phase='retry';trace.retry=attempt(()=>pending.rollback());check('terminal retry is inert',()=>{assert.equal(trace.retry.threw,false);assert.deepEqual(capture(),expected);});
}catch(e){trace.unexpected=e.stack;process.exitCode=1;}finally{armed=false;untap?.();dispose?.();tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
