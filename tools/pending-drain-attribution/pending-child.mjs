import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {quiesce} from '../lib/heap-quiescence.mjs';
import {pendingWorkload} from './pending-workload.mjs';
globalThis.ngDevMode=false;
const [dir,variant,countText,checkpoint='all',output,snapshotFile]=process.argv.slice(2);
const ownersPerTree=Number(countText),rowCount=1000,treeCount=10,fixedPrimeCount=32;
assert.ok(['anchor','fixed-distinct','fixed-same'].includes(variant));assert.ok([0,1,10,32].includes(ownersPerTree));assert.ok(['all','primed','pending','rolled-back','confirmed','destroyed'].includes(checkpoint));
const {createHeld,author,settle,destroy,pending}=await pendingWorkload(dir,variant,ownersPerTree);
const writeSnapshot=snapshotFile?(await import('node:v8')).writeHeapSnapshot:undefined;
function assertAuthored(held){for(const h of held){assert.equal(h.owners.length,ownersPerTree);assert.equal(pending(h.t),ownersPerTree);}}
function assertSettled(held){for(const h of held){assert.equal(h.owners.length,0);assert.equal(pending(h.t),0);}}
const result={node:process.version,pid:process.pid,variant,ownersPerTree,totalOwners:ownersPerTree*treeCount,treeCount,rowCount,checkpoint,heldPrimeRowsPerTree:variant==='anchor'?0:fixedPrimeCount+1,environmentKeys:Object.keys(process.env).sort(),memory:{},phaseCPU:{}};
const baseline=await quiesce({label:'baseline'});result.memory.baseline=baseline;let held=createHeld();const weak=held.map(h=>new WeakRef(h.t));
if(snapshotFile)globalThis.__ST_DIAG_HELD__=held;
result.memory.primed=await quiesce({label:'primed'});
function snapshot(){assert.ok(writeSnapshot);return writeSnapshot(snapshotFile,{exposeInternals:true,exposeNumericValues:false});}
if(checkpoint==='primed'){assert.ok(snapshotFile);result.snapshot=snapshot();}
else {
 let cpu=process.cpuUsage(),wall=performance.now();author(held);assertAuthored(held);result.phaseCPU.author={cpu:process.cpuUsage(cpu),wallMs:performance.now()-wall};result.memory.liveBeforeDrain=process.memoryUsage().heapUsed;result.memory.pending=await quiesce({label:'pending'});
 if(checkpoint==='pending'){assert.ok(snapshotFile);result.snapshot=snapshot();}
 else {
  cpu=process.cpuUsage();wall=performance.now();settle(held,checkpoint==='confirmed'?'confirmed':'rolled-back');assertSettled(held);result.phaseCPU.settlement={cpu:process.cpuUsage(cpu),wallMs:performance.now()-wall};result.memory.settledBeforeDrain=process.memoryUsage().heapUsed;result.memory.settled=await quiesce({label:'settled'});
  if(checkpoint==='rolled-back'||checkpoint==='confirmed'){assert.ok(snapshotFile);result.snapshot=snapshot();}
  else {destroy(held);held=[];if(snapshotFile)globalThis.__ST_DIAG_HELD__=undefined;result.memory.destroyed=await quiesce({label:'destroyed'});result.weakTreesAlive=weak.filter(ref=>ref.deref()!==undefined).length;if(checkpoint==='destroyed'){assert.ok(snapshotFile);result.snapshot=snapshot();}}
 }
}
// Prefix-only snapshot children clean up after capture; no later endpoint is pooled.
if(held.some(h=>h.owners.length))settle(held,'rolled-back');destroy(held);held=[];if(snapshotFile)globalThis.__ST_DIAG_HELD__=undefined;
writeFileSync(output,JSON.stringify(result)+'\n');
