const fs = require('node:fs');
const v8 = require('node:v8');
const cp = require('node:child_process');
const out = process.env.ST_RECORDER_OUTPUT;
const keys = ['CI','VITEST_MAX_WORKERS','VITEST_POOL_ID','VITEST_WORKER_ID','NODE_OPTIONS','NODE_ENV','NODE_COMPILE_CACHE','UV_THREADPOOL_SIZE','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_NO_CLOUD','ST_VERIFY_PROGRESS'];
function record(kind) {
 const row = {kind, at:Date.now(), pid:process.pid, ppid:process.ppid, argv:process.argv, execArgv:process.execArgv, node:process.version, heapLimit:v8.getHeapStatistics().heap_size_limit, memory:process.memoryUsage(), env:Object.fromEntries(keys.map(k=>[k,process.env[k]??null]))};
 if(kind==='node-start') row.pgid=Number(cp.execFileSync('/bin/ps',['-o','pgid=','-p',String(process.pid)],{encoding:'utf8'}).trim());
 fs.appendFileSync(out+'/nodes.jsonl',JSON.stringify(row)+'\n');
}
if(out) { record('node-start'); process.once('exit',()=>record('node-exit')); }
