#!/usr/bin/env node
// Six implementations, one unchanged ordinary-state child workflow.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const [mode,packetArg,outArg,bundlesArg]=process.argv.slice(2);assert(['build','pilot','control','compare'].includes(mode)&&packetArg&&outArg);
const self=fileURLToPath(import.meta.url),here=dirname(self),packet=resolve(packetArg),out=resolve(outArg),child=join(here,'long-lived.mjs'),protocol=join(here,'final-comparison-rerun-protocol.md');
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex'),save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const planPath=join(packet,'plan.json'),plan=read(planPath);assert(plan.runtimeRefresh);
const bindings={...plan.inputs,[planPath]:sha(planPath),[self]:sha(self),[child]:sha(child),[join(here,'long-lived-protocol.md')]:sha(join(here,'long-lived-protocol.md')),[protocol]:sha(protocol)};
const verify=()=>{for(const[p,h]of Object.entries(bindings))assert.equal(sha(p),h,`Input drift ${p}`);};verify();assert(!existsSync(out));mkdirSync(out,{recursive:true});
const implementations=['v15-before','v16-before','native','v15','v16','ngrx'];
const logical=name=>name.replace('-before','');
if(mode==='build'){
 const require=createRequire(join(plan.toolchainDirectory,'package.json')),esbuild=await import(pathToFileURL(require.resolve('esbuild'))),core=require.resolve('@angular/core');const receipts={};
 for(const implementation of implementations){
  const arm=logical(implementation),bundles={},selected={};
  if(arm!=='native'){
   const source=join(out,implementation+'.entry.mjs'),bundle=join(out,implementation+'.production.mjs'),metaPath=join(out,implementation+'.metafile.json');
   const entry=arm==='ngrx'?`export {signalStore,patchState} from ${JSON.stringify(require.resolve('@ngrx/signals'))};\nexport {withEntities,setAllEntities,updateEntity,removeEntity,addEntity,removeAllEntities} from ${JSON.stringify(require.resolve('@ngrx/signals/entities'))};\n`:`export {signalTree,entityMap} from ${JSON.stringify(join(packet,implementation,'node_modules/@signal-tree/angular/dist/index.js'))};\n`;
   writeFileSync(source,entry,{flag:'wx'});
   const built=await esbuild.build({entryPoints:[source],outfile:bundle,platform:'node',format:'esm',bundle:true,treeShaking:true,minify:true,metafile:true,define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'},plugins:[{name:'shared-angular-runtime',setup(build){build.onResolve({filter:/^@angular\/core$/},()=>({path:core,external:true}));}}]});
   if(arm==='v16')for(const result of Object.values(built.metafile.outputs))for(const[path,part]of Object.entries(result.inputs??{}))if(/\/lib\/link\.js$|\/experimental-publication\/entity\.js$/.test(path))assert.equal(part.bytesInOutput,0,'Ordinary consumer must omit native Link implementation');
   if(arm.startsWith('v'))for(const path of Object.keys(built.metafile.inputs))if(path.includes('/@signal-tree/'))assert(resolve(path).startsWith(join(packet,implementation,'node_modules/@signal-tree')+'/'),'Mixed SignalTree artifact');
   save(metaPath,built.metafile);for(const p of [source,bundle,metaPath,...Object.keys(built.metafile.inputs).map(p=>resolve(p))])selected[p]=sha(p);bundles[arm]=bundle;
  }
  const receipt=join(out,implementation+'.bundles.json');save(receipt,{esbuild:esbuild.version,implementation,logicalArm:arm,identity:plan.runtimeRefresh.identities[implementation]??{implementation},bundles,bindings:{...selected,[child]:sha(child)},externalAngular:core,limits:'Exact unchanged long-lived child; receipt selects actual implementation. Angular external and pinned.'});receipts[implementation]=receipt;bindings[receipt]=sha(receipt);Object.assign(bindings,selected);
 }
 verify();save(join(out,'implementations.json'),{createdUTC:new Date().toISOString(),command:[process.execPath,...process.argv.slice(1)],packet,planSha256:sha(planPath),childSha256:sha(child),bindings,receipts});
}else{
 assert(bundlesArg);const receiptPath=resolve(bundlesArg),built=read(receiptPath);assert.equal(built.packet,packet);assert.equal(built.planSha256,sha(planPath));assert.equal(built.childSha256,sha(child));bindings[receiptPath]=sha(receiptPath);for(const[p,h]of Object.entries(built.bindings)){if(bindings[p])assert.equal(bindings[p],h);bindings[p]=h;}verify();
 const schedule=[];
 const add=(implementation,rows,fields,round,repeat=0,fault)=>schedule.push({implementation,arm:logical(implementation),rows,fields,round,repeat,...(fault?{fault}:{}),implementationReceipt:built.receipts[implementation]});
 if(mode==='pilot')for(const implementation of implementations)add(implementation,10000,32,0);
 else if(mode==='control')add('v15',1000,8,0,0,'skip-write');
 else for(const rows of [1000,10000])for(const fields of [8,32])for(let round=0;round<5;round++){
  const rotated=implementations.slice(round%6).concat(implementations.slice(0,round%6));for(const implementation of rotated)add(implementation,rows,fields,round);add('v15',rows,fields,round,1);
 }
 save(join(out,'schedule.json'),{createdUTC:new Date().toISOString(),command:[process.execPath,...process.argv.slice(1)],mode,bindings,artifacts:plan.artifacts,identities:plan.runtimeRefresh.identities,schedule});const results=[];
 for(const[index,sample]of schedule.entries()){
  const path=join(out,`child-${String(index).padStart(3,'0')}.json`),args=['--expose-gc',child,'child',packet,path,JSON.stringify(sample),sample.implementationReceipt];
  const run=spawnSync(process.execPath,args,{encoding:'utf8',timeout:240000,env:{...process.env,NODE_ENV:'production'}});
  writeFileSync(path+'.log',(run.stdout??'')+(run.stderr??''),{flag:'wx'});save(join(out,`invocation-${index}.json`),{command:[process.execPath,...args],exit:run.status,signal:run.signal,resultPath:path,resultSha256:existsSync(path)?sha(path):null,logSha256:sha(path+'.log')});
  const result=existsSync(path)?read(path):{...sample,passed:false,error:'No result'};results.push(result);console.log(index,JSON.stringify(sample),result.passed?'passed':result.error);
  if(mode==='control'){assert.equal(run.status,1);assert.equal(result.failedStage,'sparse-100');assert.match(result.error,/write receipt/);}else if(run.status!==0||!result.passed)break;
 }
 verify();const passed=results.length===schedule.length&&(mode==='control'||results.every(x=>x.passed));save(join(out,'results.json'),{passed,mode,scheduleSha256:sha(join(out,'schedule.json')),results});if(!passed)process.exitCode=1;
}
