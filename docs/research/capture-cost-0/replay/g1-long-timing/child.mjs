globalThis.ngDevMode=false;
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeHeapSnapshot} from 'node:v8';
import {loadavg,totalmem,freemem,cpus} from 'node:os';
import {quiesce} from './heap-quiescence.mjs';
const [arm,task,nText='0',leavesText='16',snapshot='']=process.argv.slice(2);
const dir=process.env.ST_COST_ARTIFACT_DIR; if(!dir) throw new Error("Explicit artifact directory required");
const {signalTree,entityMap,transactions}=await import(dir+'/index.js');
const {peekInternalTransactionRuntime}=await import(dir+'/enhancers/transactions/transactions.js');
const N=Number(nText),leaves=Number(leavesText);
const result={arm,task,N,leaves,ngDevMode:globalThis.ngDevMode,node:process.version,nodeEnv:process.env.NODE_ENV ?? null,pid:process.pid,started:new Date().toISOString(),environment:{loadavg:loadavg(),free:freemem(),total:totalmem(),cpuCount:cpus().length},measurements:[]};
function fixture(enhanced=false,count=16,rows=8){const fields=Object.fromEntries(Array.from({length:count},(_,i)=>['f'+i,0]));const t=signalTree({fields,rows:entityMap()},enhanced?{enhancers:[transactions()]}:undefined);t.$.rows.setAll(Array.from({length:rows},(_,i)=>({id:String(i),value:0})));return t;}
function timing(kind,count,warmup){const enhanced=kind.startsWith('tx-'),t=fixture(enhanced),row=t.$.rows.byIdOrFail('0');let current=0;try{const step=i=>{if(kind==='scalar'){t.$.fields.f0(i);assert.equal(t.$.fields.f0(),i);}else if(kind==='entity'){t.$.rows.updateOne('0',{value:i});assert.equal(row().value,i);}else if(kind==='add-remove'){t.$.rows.addOne({id:'temporary',value:i});assert.equal(t.$.rows.byIdOrFail('temporary')().value,i);assert.equal(t.$.rows.count(),9);t.$.rows.removeOne('temporary');assert.equal(t.$.rows.byId('temporary'),undefined);assert.equal(t.$.rows.count(),8);}else{const [,shape,settle]=kind.split('-');const before=current;const pending=t.transact(()=>{if(shape!=='entity')t.$.fields.f0(i);if(shape!=='scalar')t.$.rows.updateOne('0',{value:i});});assert.equal(t.$.fields.f0(),shape==='entity'?0:i);assert.equal(row().value,shape==='scalar'?0:i);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),1);pending[settle]();current=settle==='rollback'?before:i;assert.equal(t.$.fields.f0(),shape==='entity'?0:current);assert.equal(row().value,shape==='scalar'?0:current);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),0);}};for(let i=1;i<=warmup;i++)step(i);const cpu=process.cpuUsage(),start=performance.now();for(let i=warmup+1;i<=warmup+count;i++)step(i);const ms=performance.now()-start;result.measurements.push({kind,iterations:count,warmup,elapsedMs:ms,nsPerCheckedIteration:ms*1e6/count,cpuMicros:process.cpuUsage(cpu),logicalWritesPerIteration:kind==='add-remove'?2:kind.includes('mixed')?2:1,scope:'checked public operation including reads/assertions and synchronous settlement; excludes fixture setup/destroy'});}finally{t.destroy();}}
if(task==='timing'){timing('scalar',200000,20000);timing('entity',50000,5000);timing('add-remove',10000,1000);for(const shape of ['scalar','entity','mixed'])for(const settle of ['confirm','rollback'])timing(`tx-${shape}-${settle}`,5000,500);}
else{
 const before=await quiesce({label:'before'});let held=[],weak=[];
 function populate(){const created=[],refs=[]; for(let i=0;i<N;i++){const t=fixture(task!=='idle-bare',leaves),row=t.$.rows.byIdOrFail('0');let pending;if(task==='pending-mixed'){pending=t.transact(()=>{t.$.fields.f0(1);t.$.rows.updateOne('0',{value:1});});assert.equal(t.$.fields.f0(),1);assert.equal(row().value,1);assert.equal(peekInternalTransactionRuntime(t).getPendingTurnCount(),1);}else{assert.equal(t.$.fields.f0(),0);assert.equal(row().value,0);}created.push({tree:t,pending});refs.push(new WeakRef(t),new WeakRef(row));}return {created,refs};}
 ({created:held,refs:weak}=populate());
 globalThis.costHeld=held;
 const live=await quiesce({label:'live'});result.memory={before,live,liveDeltaBytes:live.heapUsed-before.heapUsed,metric:'quiesced process heapUsed delta, NOT dominator retained size; live graph plus runtime bookkeeping'};
 if(snapshot){result.snapshot=writeHeapSnapshot(snapshot);}
 function settleHeld(){if(task==='pending-mixed'){for(let i=0;i<held.length;i++){const h=held[i],method=i%2?'confirm':'rollback';h.pending[method]();const expected=i%2?1:0;assert.equal(h.tree.$.fields.f0(),expected);assert.equal(h.tree.$.rows.byIdOrFail('0')().value,expected);assert.equal(peekInternalTransactionRuntime(h.tree).getPendingTurnCount(),0);h.pending[method]();h.pending=undefined;}}} settleHeld();
 result.memory.settled=await quiesce({label:'settled-live'});result.memory.settledDeltaBytes=result.memory.settled.heapUsed-before.heapUsed;
 function destroyHeld(){for(const h of held)h.tree.destroy();} destroyHeld();held=[];globalThis.costHeld=undefined;
 result.memory.destroyed=await quiesce({label:'destroyed'});result.memory.destroyedDeltaBytes=result.memory.destroyed.heapUsed-before.heapUsed;result.memory.weakTargets=weak.length;result.memory.weakAlive=weak.filter(ref=>ref.deref()!==undefined).length;
}
result.ended=new Date().toISOString();result.environment.endLoadavg=loadavg();console.log(JSON.stringify(result));
