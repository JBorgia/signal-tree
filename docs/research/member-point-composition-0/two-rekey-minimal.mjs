import assert from 'node:assert/strict';
import {createSignalTreeFactory} from '@signal-tree/kernel/adapter';
import {entityMap,transactions} from '@signal-tree/kernel';
import {createSolidObservationAdapter} from '@proof/packages/solid/src/lib/solid-observation.ts';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
import {hasOpenCommitScope} from '@proof/packages/kernel/src/lib/internals/commit-consequence.ts';
const mode=process.argv[2]??'rekeys';
assert.ok(['rekeys','updates','scalar-rekeys','scalar-updates','member-rekeys','member-updates'].includes(mode));
const trace={mode,faultModel:'none; ordinary public operations',checks:[]};
const base=createSolidObservationAdapter();let tree;
const check=(name,fn)=>{try{fn();trace.checks.push({name,pass:true});}catch(e){trace.checks.push({name,pass:false,error:e.stack});process.exitCode=1;}};
const attempt=fn=>{try{fn();return {threw:false};}catch(e){return {threw:true,message:e?.message,code:e?.code};}};
try{
 tree=createSignalTreeFactory(base)({count:0,box:{keep:0,optional:{x:0}},rows:entityMap()},{enhancers:[transactions()]});
 const rows=tree.$.rows;rows.addOne({id:'A',v:10});rows.addOne({id:'D',v:20});
 const heldA=rows.byIdOrFail('A'),heldD=rows.byIdOrFail('D');
 if(mode.startsWith('member'))tree.$.box({keep:0});
 const lookup=k=>rows.byId(k)?.();
 const read=()=>structuredClone({keys:[...rows.ids()],all:rows.all(),A:lookup('A'),B:lookup('B'),D:lookup('D'),E:lookup('E'),heldA:heldA(),heldD:heldD(),count:tree.$.count(),optional:tree.$.box.optional(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount(),scope:hasOpenCommitScope(tree)});
 trace.before=read();
 const pending=tree.transact(()=>{
  if(mode.startsWith('scalar')||mode.startsWith('member'))tree.$.count.set(1);
  if(mode.startsWith('member'))tree.$.box.optional.x.set(1);
  if(mode.endsWith('updates'))rows.updateOne('A',{v:11});
  rows.changeId('A','B');
  if(mode.endsWith('updates'))rows.updateOne('D',{v:21});
  rows.changeId('D','E');
 });
 trace.speculative=read();
 check('both rekeys performed and held lifetimes retained',()=>{assert.deepEqual(trace.speculative.keys,['B','E']);assert.equal(rows.byId('B'),heldA);assert.equal(rows.byId('E'),heldD);assert.equal(trace.speculative.pending,1);if(mode.endsWith('updates')){assert.equal(trace.speculative.B.v,11);assert.equal(trace.speculative.E.v,21);}});
 trace.rollback=attempt(()=>pending.rollback());trace.after=read();
 check('rollback succeeds and completely restores both keys and values',()=>{assert.equal(trace.rollback.threw,false);assert.deepEqual(trace.after,{...trace.before,pending:0,scope:false});});
 check('both restored lookups retain original lifetimes',()=>{assert.equal(rows.byId('A'),heldA);assert.equal(rows.byId('D'),heldD);assert.equal(rows.byId('B'),undefined);assert.equal(rows.byId('E'),undefined);});
 trace.retry=attempt(()=>pending.rollback());trace.afterRetry=read();
 check('retry succeeds and preserves complete restoration',()=>{assert.equal(trace.retry.threw,false);assert.deepEqual(trace.afterRetry,{...trace.before,pending:0,scope:false});});
}catch(e){trace.unexpected=e.stack;process.exitCode=1;}finally{tree?.destroy();base.dispose?.();}
console.log(JSON.stringify(trace,null,2));
