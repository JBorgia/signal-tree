#!/usr/bin/env node
// Active-Link population under pending authority. Installed packages only.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
const [mode, inputArg, outputArg, extraArg] = process.argv.slice(2);
assert.ok(['build','compare','child'].includes(mode) && inputArg && outputArg);
const runner=fileURLToPath(import.meta.url),input=resolve(inputArg),output=resolve(outputArg);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
if(mode==='build'){
 // build BASELINE_PACKET NEW_BUNDLES CANDIDATE_PACKET
 assert.ok(extraArg && !existsSync(output));mkdirSync(output,{recursive:true});
 const summaries=[];
 for(const [arm,packet] of [['baseline',input],['lazy',resolve(extraArg)]]){
  const planPath=join(packet,'plan.json'),plan=read(planPath),artifact=plan.artifacts['v16-kernel'];
  for(const [path,expected]of Object.entries(plan.inputs))assert.equal(sha(path),expected,`Input drift ${path}`);
  assert.equal('sha512-'+createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'),artifact.integrity);
  const root=join(packet,'v16/node_modules/@signal-tree/kernel'),pkg=read(join(root,'package.json'));
  const entry=resolve(root,pkg.exports['.'].import),internals=resolve(root,pkg.exports['./internals'].import);
  const source=join(output,arm+'.entry.mjs');
  writeFileSync(source,`import {signalTree,entityMap,transactions,link} from ${JSON.stringify(entry)};\nimport {transactionLifecycleReader} from ${JSON.stringify(internals)};\nexport function create(){return signalTree({rows:entityMap({selectId:r=>r.id})},{enhancers:[transactions()]});}\nexport function attach(tree,sink){return link(tree.$.rows,{set:sink});}\nexport function populate(tree,rows){tree.$.rows.setAll(rows);}\nexport function read(tree){return tree.$.rows.all();}\nexport function pending(tree){return transactionLifecycleReader(tree).snapshot().pending.length;}\n`,{flag:'wx'});
  const require=createRequire(join(plan.toolchainDirectory,'package.json'));
  const {build,version}=require('esbuild');
  const bundle=join(output,arm+'.production.mjs');
  const result=await build({entryPoints:[source],outfile:bundle,bundle:true,minify:true,treeShaking:true,format:'esm',platform:'browser',target:'es2022',define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'},external:['@angular/*','rxjs','rxjs/*','tslib'],metafile:true,logLevel:'silent'});
  save(join(output,arm+'.metafile.json'),result.metafile);
  summaries.push({arm,root,packageVersion:pkg.version,planPath,planSha256:sha(planPath),archive:artifact.archive,archiveIntegrity:artifact.integrity,sourceSeal:artifact.sourceSeal,source,sourceSha256:sha(source),bundle,bundleSha256:sha(bundle),esbuild:version});
 }
 save(join(output,'bundles.json'),{createdUTC:new Date().toISOString(),command:process.argv,runnerSha256:sha(runner),summaries});
}else if(mode==='compare'){
 assert.ok(!existsSync(output));mkdirSync(output,{recursive:true});
 const rounds=extraArg===undefined?5:Number(extraArg);assert.ok(Number.isInteger(rounds)&&rounds>0);
 const reportPath=join(input,'bundles.json'),report=read(reportPath);assert.equal(sha(runner),report.runnerSha256);
 const schedule=[];for(const rows of [1000,10000])for(let round=0;round<rounds;round++)for(const settlement of ['confirm','rollback'])for(const arm of round%2?['lazy','baseline']:['baseline','lazy'])schedule.push({arm,rows,round,settlement});
 save(join(output,'schedule.json'),{createdUTC:new Date().toISOString(),command:process.argv,runnerSha256:sha(runner),reportSha256:sha(reportPath),schedule,limits:'Fresh serial child processes. Neutral kernel, active collection Link before population. Three job-separated GCs measure retained pending and settled memory. Synchronous heap observations are a transient high-water lower bound, not true peak allocation. Shared-host timings are diagnostic. Source runtime unchanged.'});
 const results=[];
 for(let i=0;i<schedule.length;i++){
  const path=join(output,`${String(i).padStart(3,'0')}.json`),command=['--expose-gc',runner,'child',input,path,JSON.stringify(schedule[i])];
  const child=spawnSync(process.execPath,command,{encoding:'utf8',timeout:180000,env:{...process.env,NODE_ENV:'production'}});
  writeFileSync(path+'.log',(child.stdout??'')+(child.stderr??''),{flag:'wx'});
  const result=existsSync(path)?read(path):undefined;
  save(path+'.receipt.json',{command:[process.execPath,...command],exit:child.status,signal:child.signal,error:child.error?String(child.error):undefined,resultSha256:result?sha(path):undefined});
  if(result)results.push(result);console.log(i,schedule[i].arm,schedule[i].rows,schedule[i].settlement,result?.passed?'passed':'FAILED');
  if(child.status!==0||!result?.passed)break;
 }
 const passed=results.length===schedule.length&&results.every(r=>r.passed);
 const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
 const groups=[];for(const rows of [1000,10000])for(const settlement of ['confirm','rollback']){
  const cells={};for(const arm of ['baseline','lazy']){const values=results.filter(r=>r.sample.rows===rows&&r.sample.settlement===settlement&&r.sample.arm===arm);if(values.length)cells[arm]={n:values.length,populationMs:median(values.map(r=>r.stages.population.elapsedNs/1e6)),populationValuesMs:values.map(r=>r.stages.population.elapsedNs/1e6),heaps:Object.fromEntries(Object.keys(values[0].heapBytes).map(key=>[key,{median:median(values.map(r=>r.heapBytes[key]-r.heapBytes.before)),values:values.map(r=>r.heapBytes[key]-r.heapBytes.before)}]))};}
  groups.push({rows,settlement,cells});
 }
 save(join(output,'results.json'),{passed,scheduleSha256:sha(join(output,'schedule.json')),reportSha256:sha(reportPath),results,groups});if(!passed)process.exitCode=1;
}else{
 const report=read(join(input,'bundles.json'));assert.equal(sha(runner),report.runnerSha256);
 const sample=JSON.parse(extraArg),bundle=report.summaries.find(b=>b.arm===sample.arm);assert.ok(bundle);assert.equal(sha(bundle.bundle),bundle.bundleSha256);assert.ok([1000,10000].includes(sample.rows));assert.ok(['confirm','rollback'].includes(sample.settlement));assert.equal(typeof global.gc,'function');
 const api=await import(pathToFileURL(bundle.bundle).href);
 const flush=async()=>{for(let i=0;i<160;i++)await Promise.resolve();};
 const heap=async()=>{for(let i=0;i<3;i++){await new Promise(r=>setImmediate(r));global.gc();}return process.memoryUsage().heapUsed;};
 const rows=Array.from({length:sample.rows},(_,i)=>Object.fromEntries([['id','R-'+i],...Array.from({length:8},(_,f)=>['v'+f,i*10+f])]));
 const result={sample,node:process.version,pid:process.pid,bundleSha256:bundle.bundleSha256,host:{cpu:os.cpus()[0]?.model,load:os.loadavg()},heapBytes:{before:await heap()},stages:{},passed:false};
 const timed=(name,run)=>{const cpu=process.cpuUsage(),start=process.hrtime.bigint();const value=run();result.stages[name]={elapsedNs:Number(process.hrtime.bigint()-start),cpuUs:process.cpuUsage(cpu)};return value;};
 let tree,connection,handle,deliveries=0,lastCount=-1,lastSum=-1;
 try{
  tree=api.create();connection=api.attach(tree,values=>{deliveries++;lastCount=values.length;lastSum=values.reduce((sum,row)=>sum+row.v0,0);});await flush();assert.equal(deliveries,0);
  result.heapBytes.empty=await heap();
  handle=timed('population',()=>tree.transact(()=>{api.populate(tree,rows.map(row=>({...row})));result.heapBytes.synchronousAfterWrite=process.memoryUsage().heapUsed;}));
  result.heapBytes.synchronousAfterTransaction=process.memoryUsage().heapUsed;
  assert.deepEqual(api.read(tree),rows);assert.equal(api.pending(tree),1);
  await flush();if(sample.control==='early-send')deliveries++;assert.equal(deliveries,0,'No outbound delivery before settlement');
  result.heapBytes.pending=await heap();assert.equal(api.pending(tree),1);assert.equal(deliveries,0);
  timed('settlement',()=>handle[sample.settlement]());await flush();await connection.settled();
  assert.equal(api.pending(tree),0);
  if(sample.settlement==='confirm'){assert.deepEqual(api.read(tree),rows);assert.equal(deliveries,1);assert.equal(lastCount,sample.rows);assert.equal(lastSum,5*sample.rows*(sample.rows-1));}
  else{assert.deepEqual(api.read(tree),[]);assert.equal(deliveries,1);assert.equal(lastCount,0);assert.equal(lastSum,0);}
  result.heapBytes.settledHandleHeld=await heap();handle=undefined;result.heapBytes.settledHandleDropped=await heap();
  result.deliveries=deliveries;
  connection.dispose();connection=undefined;result.heapBytes.disposedLink=await heap();
  tree.destroy();tree=undefined;result.heapBytes.destroyed=await heap();result.passed=true;
 }catch(error){result.error=String(error.stack);process.exitCode=1;}finally{connection?.dispose();tree?.destroy();save(output,result);}
}
