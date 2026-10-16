import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';
const [file,scenario,sizeText,countText]=process.argv.slice(2);const size=+sizeText,count=+countText;
const {createStore}=await import(pathToFileURL(file));const s=createStore();
const gc=async()=>{for(let i=0;i<3;i++){await new Promise(r=>setImmediate(r));globalThis.gc?.();}};
await gc();const emptyHeap=process.memoryUsage().heapUsed;
for(let i=0;i<size;i++)s.add(String(i),{n:0});await s.flush();let held=s.get('0');
await gc();const seededHeap=process.memoryUsage().heapUsed;
let events=[];let off=scenario==='observed'?s.observe(()=>events.push(held.read().n)):()=>{};
const cycle=async()=>{
 if(scenario==='ordinary'){held.write({n:1});assert.equal(held.read().n,1);held.write({n:0});}
 else if(scenario==='overlap'){const a=s.begin(()=>held.write({n:1}));const b=s.begin(()=>held.write({n:2}));assert.equal(held.read().n,2);a.reject();assert.equal(held.read().n,2);b.reject();assert.equal(a.state(),'rejected');assert.equal(b.state(),'rejected');}
 else {const p=s.begin(()=>held.write({n:1}));assert.equal(held.read().n,1);if(scenario==='observed'){await s.flush();assert.deepEqual(events,[1]);events=[];}p.reject();assert.equal(p.state(),'rejected');p.reject();}
 assert.equal(held.read().n,0);
 await s.flush();if(scenario==='observed'){assert.deepEqual(events,[0]);events=[];}assert.deepEqual(s.takeErrors(),[]);
};
for(let i=0;i<31;i++)await cycle();await gc();let countsSupported=true;try{s.resetStats();}catch(e){if(e.code==='UNSUPPORTED')countsSupported=false;else throw e;}
const beforeHeap=process.memoryUsage().heapUsed,cpuStart=process.cpuUsage(),start=performance.now();
for(let i=0;i<count;i++)await cycle();const ms=performance.now()-start,cpu=process.cpuUsage(cpuStart);
await gc();const afterHeap=process.memoryUsage().heapUsed;const stats=countsSupported?s.stats():null;
off();s.destroy();held=null;await gc();const destroyedHeap=process.memoryUsage().heapUsed;
console.log(JSON.stringify({file,scenario,size,count,node:process.version,cpuUsPerCycle:(cpu.user+cpu.system)/count,wallUsPerCycle:ms*1000/count,emptyHeap,seededHeap,seedHeapDelta:seededHeap-emptyHeap,beforeHeap,afterHeap,loopHeapDelta:afterHeap-beforeHeap,destroyedHeap,stats,notes:'whole-process post-GC heap; model store still referenced after destroy; async flush and assertions included; no production speed claim'}));
