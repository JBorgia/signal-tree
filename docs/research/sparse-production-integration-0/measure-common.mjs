// Matched public-API workload. Each invocation is one fresh Node process.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const [repo, scenario='scalar', countText='500', sizeText='32'] = process.argv.slice(2);
const count=Number(countText),size=Number(sizeText);
globalThis.ngDevMode=false;
const {signalTree,transactions,entityMap}=await import(pathToFileURL(`${repo}/dist/packages/kernel/dist/index.js`));
const make=()=>signalTree({x:0,rows:entityMap({selectId:row=>row.id})},{enhancers:[transactions()]});
const tree=make();
if(scenario!=='scalar')tree.$.rows.addMany(Array.from({length:size},(_,id)=>({id,n:0})));
const held=scenario==='scalar'?undefined:tree.$.rows.byId(0);
const gc=async()=>{for(let i=0;i<3;i++){await new Promise(resolve=>setImmediate(resolve));globalThis.gc?.();}};
const cycle=()=>{const p=tree.transact(()=>{if(scenario==='scalar')tree.$.x(1);else tree.$.rows.updateOne(0,{n:1});});assert.equal(scenario==='scalar'?tree.$.x():held().n,1);p.rollback();assert.equal(scenario==='scalar'?tree.$.x():held().n,0);assert.equal(p.inspect().changes.length,1);p.rollback();};
// Preflight proves both intermediate visibility and settlement; never time refusal.
cycle();for(let i=0;i<30;i++)cycle();await gc();
const before=process.memoryUsage().heapUsed;const cpuStart=process.cpuUsage();const start=performance.now();
for(let i=0;i<count;i++)cycle();
const elapsed=performance.now()-start;const cpu=process.cpuUsage(cpuStart);await gc();const after=process.memoryUsage().heapUsed;
assert.equal(scenario==='scalar'?tree.$.x():held().n,0);
tree.destroy();await gc();
console.log(JSON.stringify({scenario,count,size,elapsedMs:elapsed,cpuUserUs:cpu.user,cpuSystemUs:cpu.system,cpuUsPerCycle:(cpu.user+cpu.system)/count,nsPerCycle:elapsed*1e6/count,heapBefore:before,heapAfter:after,heapDelta:after-before,heapAfterDestroy:process.memoryUsage().heapUsed,node:process.version,exposeGc:typeof globalThis.gc==='function',obligations:'public transact, intermediate read, successful rollback, terminal inspection; no application observer; assertion cost included'}));
