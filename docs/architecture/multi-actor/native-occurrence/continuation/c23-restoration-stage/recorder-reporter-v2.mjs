import {appendFileSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import v8 from 'node:v8';
const dir=process.env.ST_RECORDER_OUTPUT;
const keys=['CI','VITEST_MAX_WORKERS','NODE_OPTIONS','NODE_ENV','NODE_COMPILE_CACHE','UV_THREADPOOL_SIZE'];
const env=()=>Object.fromEntries(keys.map(k=>[k,process.env[k]??null]));
function census(kind) {
 const {registeredGroups}=JSON.parse(readFileSync(dir+'/OWNERSHIP.json','utf8'));
 const raw=execFileSync('/bin/ps',['-axo','pid=,ppid=,pgid=,state=,pcpu=,rss=,etime=,command='],{encoding:'utf8'});
 const rows=raw.split('\n').map(line=>line.trim()).filter(line=>line&&registeredGroups.includes(Number(line.split(/\s+/)[2])));
 appendFileSync(dir+'/boundary-census.jsonl',JSON.stringify({kind,at:Date.now(),registeredGroups,rows})+'\n');
}
function record(kind,item={},extra={}) {
 const row={kind,at:Date.now(),pid:process.pid,file:item.moduleId??item.module?.moduleId,name:item.fullName,...extra};
 appendFileSync(dir+'/events.jsonl',JSON.stringify(row)+'\n');
}
export default class Recorder {
 onInit(ctx){this.ctx=ctx;record('init',{}, {env:env(),execArgv:process.execArgv});}
 onTestRunStart(specs){
  const projects=[...new Set(specs.map(s=>s.project))];
  record('resolved-config',{}, {projects:projects.map(p=>({name:p.config.name,pool:p.config.pool,isolate:p.config.isolate,maxWorkers:p.config.maxWorkers,fileParallelism:p.config.fileParallelism,execArgv:p.config.execArgv,environment:p.config.environment,env:Object.fromEntries(keys.map(k=>[k,p.config.env?.[k]??null]))})),files:specs.map(s=>s.moduleId)});
 }
 onTestModuleStart(m){record('module-start',m,{coordinatorMemory:process.memoryUsage(),heapLimit:v8.getHeapStatistics().heap_size_limit});census('module-start');}
 onTestModuleEnd(m){record('module-end',m,{coordinatorMemory:process.memoryUsage()});census('module-end');}
 onTestCaseReady(t){record('case-start',t);}
 onTestCaseResult(t){record('case-end',t,{result:t.result()});}
}
