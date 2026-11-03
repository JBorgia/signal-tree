import assert from 'node:assert/strict';
import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
import {peekInternalTransactionRuntime} from '@proof/packages/kernel/src/enhancers/transactions/transactions.ts';
const mode=process.argv[2];class Row{constructor(v){this.id='A';this.v=v;}}
const make=v=>mode==='array'?['A',v]:mode==='number'?v:mode==='string'?String(v):mode==='class'?new Row(v):mode==='date'?new Date(v):mode==='map'?new Map([['v',v]]):mode==='set'?new Set([v]):{id:'A',v};
const output={mode,cases:[]};
for(const fault of [false,true]){
 const trace={fault,hits:0};output.cases.push(trace);let armed=false;
 const tree=signalTree({scalar:0,rows:entityMap({selectId:()=> 'A'})},{enhancers:[transactions()]});
 globalThis.__entityCaptureProbe=(path,next,prev,subjects)=>{if(armed&&subjects?.length){trace.hits++;throw Error('controlled rich capture failure');}};
 try{
  tree.$.rows.addOne(make(10));const state=()=>({scalar:tree.$.scalar(),rows:tree.$.rows.all(),pending:peekInternalTransactionRuntime(tree).getPendingTurnCount()});trace.initial=state();
  armed=fault;const pending=tree.transact(()=>{tree.$.scalar(1);tree.$.rows.replaceOne('A',make(11));});armed=false;
  trace.speculative=state();assert.equal(trace.speculative.scalar,1);assert.equal(trace.speculative.pending,1);assert.notDeepEqual(trace.speculative.rows,trace.initial.rows);
  pending.rollback();trace.after=state();assert.deepEqual(trace.after,trace.initial);pending.rollback();assert.deepEqual(state(),trace.initial);
  const next=tree.transact(()=>{tree.$.scalar(2);tree.$.rows.replaceOne('A',make(12));});const accepted=state();next.confirm();assert.deepEqual(state(),{...accepted,pending:0});trace.status='pass';
 }catch(e){trace.status='fail';trace.error=e.stack;process.exitCode=1;}finally{armed=false;delete globalThis.__entityCaptureProbe;tree.destroy();}
}
console.log(JSON.stringify(output,null,2));
