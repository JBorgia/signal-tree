#!/usr/bin/env node
// Separate post-GC process-heap screen; never mixed with CPU samples.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {setImmediate as nextJob} from 'node:timers/promises';
import {inspect} from 'node:util';
const runner=fileURLToPath(import.meta.url),[mode,...args]=process.argv.slice(2);
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const verify=b=>{for(const[p,h]of Object.entries(b))assert.equal(sha(p),h,`bound input ${p}`);};
const stages=['empty','populatedUndemanded','firstAll','idsAndAll','editedHeldSnapshot','snapshotReleased','structuralChurn','destroyed'];
function schedule(controls){
 const result=[];if(controls)return[undefined,'value','held-snapshot','order'].map(fault=>({arm:'baseline',rows:100,width:8,activation:'bare',round:0,...fault?{fault}:{}}));
 let profile=0;for(const width of [8,32])for(const activation of ['bare','native-loaded']){
  for(let round=0;round<3;round++){
   for(const arm of (round+profile)%2?['candidate','baseline']:['baseline','candidate'])result.push({arm,rows:10000,width,activation,round});
   if(round!==1)for(const repeat of [0,1])result.push({arm:'baseline',rows:10000,width,activation,round,repeat,control:'AA'});
  }profile++;
 }return result;
}
if(mode==='controls'||mode==='compare'){
 const[baseArg,candArg,outArg]=args,out=resolve(outArg),packets={baseline:resolve(baseArg),candidate:resolve(candArg)};assert(!existsSync(out));mkdirSync(out,{recursive:true});
 const frozenRunner=join(out,'runner.mjs');writeFileSync(frozenRunner,readFileSync(runner),{flag:'wx'});const bindings={[frozenRunner]:sha(frozenRunner),[process.execPath]:sha(process.execPath)};
 for(const dir of Object.values(packets)){const p=join(dir,'packet.json');bindings[p]=sha(p);Object.assign(bindings,read(p).bindings);}verify(bindings);
 const samples=schedule(mode==='controls');write(join(out,'schedule.json'),{kind:'projection-heap-screen-v1',node:process.version,command:[process.execPath,...process.argv.slice(1)],packets,samples,bindings,stages,limits:'Separate fresh Node children; four GC checkpoints separated by real event-loop jobs per stage. Whole-process heap, with identical external expected-value fixtures. No retained-dominator or allocation-byte claim. Three paired rounds, two A/A pairs per row-width/module profile; no confidence interval.'});
 const results=[];
 for(const[index,sample]of samples.entries()){
  const resultPath=join(out,`child-${index}.json`),command=[process.execPath,'--expose-gc',frozenRunner,'child',packets[sample.arm],resultPath,JSON.stringify(sample)],child=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:120000});
  const log=resultPath+'.log';writeFileSync(log,(child.stdout??'')+(child.stderr??''),{flag:'wx'});const value=existsSync(resultPath)?read(resultPath):undefined,wanted=sample.fault&&`oracle-${sample.fault}`;
  let error;try{
   assert(value);assert(!child.signal&&!child.error,'Clean child exit');assert.equal(value.packetPath,join(packets[sample.arm],'packet.json'));assert.equal(value.bundleSha256,read(value.packetPath).bundles[sample.activation].sha256);assert(Number.isSafeInteger(value.pid)&&value.pid>0);assert.deepEqual(value.sample,sample);assert.equal(value.node,process.version);assert.equal(value.packetSha256,sha(join(packets[sample.arm],'packet.json')));assert(!Object.hasOwn(value,'cleanupError'));
   if(wanted){assert.equal(child.status,1);assert.equal(value.passed,false);assert(value.error.includes(wanted));}
   else{assert.equal(child.status,0);assert.equal(value.passed,true);assert.deepEqual(Object.keys(value.heap),stages);for(const checkpoint of Object.values(value.heap))for(const field of ['heapUsed','heapTotal','external','rss'])assert(Number.isSafeInteger(checkpoint[field])&&checkpoint[field]>0);}
  }catch(caught){error=inspect(caught);}
  const record={index,sample,command,exitCode:child.status,signal:child.signal,childError:child.error?String(child.error):undefined,resultPath,resultSha256:value?sha(resultPath):undefined,log,logSha256:sha(log),passed:!error,admissionError:error};write(join(out,`invocation-${index}.json`),record);results.push(record);if(error)break;
 }
 verify(bindings);const passed=results.length===samples.length&&results.every(r=>r.passed);write(join(out,'results.json'),{passed,scheduleSha256:sha(join(out,'schedule.json')),results});if(!passed)process.exitCode=1;
}else if(mode==='child'){
 const[packetArg,outArg,sampleArg]=args,packetPath=join(resolve(packetArg),'packet.json'),packet=read(packetPath),sample=JSON.parse(sampleArg);verify(packet.bindings);assert.equal(typeof globalThis.gc,'function');
 const{signalTree,entityMap}=await import(pathToFileURL(packet.bundles[sample.activation].path));
 const result={sample,node:process.version,pid:process.pid,packetPath,packetSha256:sha(packetPath),bundleSha256:packet.bundles[sample.activation].sha256,heap:{},passed:false};let tree,map,first,input,expected;
 const checkpoint=async name=>{for(let i=0;i<4;i++){await nextJob();globalThis.gc();}const m=process.memoryUsage();result.heap[name]={heapUsed:m.heapUsed,heapTotal:m.heapTotal,external:m.external,rss:m.rss};};
 const assertCurrent=()=>assert.deepEqual(map.all(),[...expected.values()],'oracle-value');
 try{
  tree=signalTree({rows:entityMap({selectId:row=>row.id})});map=tree.$.rows;await checkpoint('empty');
  input=Array.from({length:sample.rows},(_,id)=>Object.fromEntries([['id',id],['value',id],...Array.from({length:sample.width-2},(_,i)=>['f'+i,id+i])]));expected=new Map(input.map(row=>[row.id,row]));map.setAll(input);assert.equal(map.count(),sample.rows);input=undefined;await checkpoint('populatedUndemanded');
  first=map.all();assertCurrent();await checkpoint('firstAll');
  assert.deepEqual(map.ids(),[...expected.keys()]);assertCurrent();await checkpoint('idsAndAll');
  for(let i=0;i<1000;i++){const id=(i*97)%sample.rows;map.updateOne(id,{value:sample.rows+i});expected.set(id,{...expected.get(id),value:sample.rows+i});}
  if(sample.fault==='value')expected.set(0,{...expected.get(0),value:-1});assertCurrent();
  if(sample.fault==='held-snapshot')first[0].value=-1;assert.equal(first[0].value,0,'oracle-held-snapshot');assert.equal(first.length,sample.rows);await checkpoint('editedHeldSnapshot');
  first=undefined;await checkpoint('snapshotReleased');
  for(let i=0;i<100;i++){const id=i%sample.rows;map.removeOne(id);expected.delete(id);const row=Object.fromEntries([['id',id],['value',-id],...Array.from({length:sample.width-2},(_,j)=>['f'+j,-id-j])]);map.addOne(row);expected.set(id,row);}
  if(sample.fault==='order')assert.deepEqual(map.ids(),[...expected.keys()].reverse(),'oracle-order');else assert.deepEqual(map.ids(),[...expected.keys()],'oracle-order');assertCurrent();await checkpoint('structuralChurn');
  tree.destroy();tree=undefined;map=undefined;expected=undefined;await checkpoint('destroyed');verify(packet.bindings);result.passed=true;
 }catch(error){result.error=error instanceof Error?error.stack:inspect(error);process.exitCode=1;}
 finally{try{tree?.destroy();}catch(error){result.cleanupError=inspect(error);result.passed=false;process.exitCode=1;}write(resolve(outArg),result);}
}else throw Error('controls BASE_PACKET CAND_PACKET OUT | compare BASE_PACKET CAND_PACKET OUT | child PACKET OUT SAMPLE');
