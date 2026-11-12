#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {join,resolve} from 'node:path';
const [mode,inputArg,outArg,sampleArg]=process.argv.slice(2);assert.ok(['compare','child'].includes(mode));
const input=resolve(inputArg),out=resolve(outArg),runner=import.meta.filename,protocol=join(import.meta.dirname,'v16-residual-census-protocol.md');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const reportPath=join(input,'bundles.json'),artifact=read(reportPath).summaries.find(x=>x.arm==='lazy');
assert.equal(sha(artifact.bundle),artifact.bundleSha256);assert.equal(sha(artifact.source),artifact.sourceSha256);assert.equal(sha(artifact.planPath),artifact.planSha256);assert.equal('sha512-'+crypto.createHash('sha512').update(fs.readFileSync(artifact.archive)).digest('base64'),artifact.archiveIntegrity);
const bindings=Object.fromEntries([runner,protocol,reportPath,artifact.bundle,artifact.source,artifact.planPath,artifact.archive].map(p=>[p,sha(p)]));const verify=()=>{for(const[p,h]of Object.entries(bindings))assert.equal(sha(p),h);};
if(mode==='compare'){
 fs.mkdirSync(out,{recursive:false});const schedule=[{recipient:false},{recipient:true}];save(join(out,'schedule.json'),{command:[process.execPath,...process.argv.slice(1)],createdUTC:new Date().toISOString(),bindings,schedule});const results=[];
 for(const[index,sample]of schedule.entries()){
  const path=join(out,`child-${index}.json`),args=['--expose-gc',runner,'child',input,path,JSON.stringify(sample)];const c=spawnSync(process.execPath,args,{encoding:'utf8',timeout:240000,env:{...process.env,NODE_ENV:'production'}});
  fs.writeFileSync(path+'.log',(c.stdout??'')+(c.stderr??''),{flag:'wx'});save(join(out,`invocation-${index}.json`),{command:[process.execPath,...args],status:c.status,signal:c.signal,resultSha256:fs.existsSync(path)?sha(path):null,logSha256:sha(path+'.log')});results.push(read(path));console.log(index,sample,c.status);if(c.status!==0)break;
 }
 verify();save(join(out,'results.json'),{passed:results.length===2&&results.every(r=>r.passed),bindings,results});
}else{
 const sample=JSON.parse(sampleArg);assert.equal(typeof global.gc,'function');const api=await import(pathToFileURL(artifact.bundle));
 const originalDescriptor=Object.getOwnPropertyDescriptor(Map.prototype,'set'),original=Map.prototype.set,recorded=new WeakSet(),maps=[];
 const result={sample,pid:process.pid,bundleSha256:artifact.bundleSha256,cycles:[],passed:false};
 Object.defineProperty(Map.prototype,'set',{...originalDescriptor,value:function(key,value){const r=Reflect.apply(original,this,[key,value]);if(this.size>1024&&!recorded.has(this)){recorded.add(this);maps.push({ref:new WeakRef(this),stack:new Error().stack,keyType:typeof key,valueType:typeof value});}return r;}});
 const tree=api.create();let deliveries=0,badPayloads=0;const connection=sample.recipient?api.attach(tree,values=>{deliveries++;if(values.length)badPayloads++;}):undefined;
 const flush=async()=>{for(let n=0;n<160;n++)await Promise.resolve();};const gc=async()=>{for(let n=0;n<3;n++){await new Promise(r=>setImmediate(r));global.gc();}};
 const outcomes=owners=>{const counts={};for(const o of owners??[])counts[String(o.outcome)]=(counts[String(o.outcome)]??0)+1;return counts;};
 const requirement=r=>r?{ownWindowOnly:r.retirementOwnWindowOnly??null,unknown:r.unknown??null,captureWindow:r.captureWindow??null,known:outcomes(r.known),possible:outcomes(r.possible),inputs:r.inputs?.length??0,frames:r.frames?.length??0,components:r.components?.length??0,proof:r.proof?{owners:outcomes(r.proof.owners),destination:outcomes(r.proof.destination),input:outcomes(r.proof.input),validation:outcomes(r.proof.validation),possible:outcomes(r.proof.possible),unknown:r.proof.unknown,invalid:r.proof.invalid,terminalRejectedRoles:r.proof.terminalRejectedRoles??0,unavailableInput:r.proof.unavailableInput??false}:null}:null;
 const shape=v=>v&&typeof v==='object'?{type:v.constructor?.name??'object',size:v instanceof Map||v instanceof Set?v.size:undefined,weakRef:v instanceof WeakRef,keys:Object.keys(v).slice(0,10)}:{type:typeof v,value:typeof v==='string'?v.slice(0,50):v};
 try{
  const collection=tree.$.rows,symbol=Object.getOwnPropertySymbols(collection).find(s=>s.description==='signaltree.entityPublication');assert.ok(symbol);const source=collection[symbol].source;assert.equal(typeof source.inspect,'function');
  await flush();assert.equal(deliveries,0);
  async function cycle(number){const rows=Array.from({length:1000},(_,i)=>Object.fromEntries([['id',`R-${i}`],...Array.from({length:8},(_,f)=>[`v${f}`,number*100000+i*10+f])]));const before=deliveries;let tx=tree.transact(()=>api.populate(tree,rows));try{assert.deepEqual(api.read(tree),rows);assert.equal(api.pending(tree),1);const ids=[...collection.__subjectIds];assert.equal(ids.length,1000);await flush();assert.equal(deliveries,before);tx.rollback();tx=undefined;await flush();await connection?.settled();assert.deepEqual(api.read(tree),[]);assert.equal(api.pending(tree),0);assert.equal(badPayloads,0);if(number===1&&sample.recipient)assert.ok(deliveries>before);return ids;}finally{tx?.rollback();}}
  for(let n=1;n<=30;n++){
   const ids=await cycle(n);await gc();for(const id of ids)assert.equal(collection.__inspectSubjectResources(id),undefined);assert.deepEqual(collection.__listSubjectReclamationCandidates(),[]);
   if([1,2,10,20,30].includes(n)){
    const surviving=[];for(const m of maps){const map=m.ref.deref();if(!map)continue;const first=[];for(const[k,v]of map){first.push({key:shape(k),value:shape(v)});if(first.length===3)break;}surviving.push({size:map.size,stack:m.stack,keyType:m.keyType,valueType:m.valueType,first});}
    const id=ids[0],e=source.evidence();result.cycles.push({cycle:n,publication:source.inspect(),retiredSubject:id,evidence:{memberOrdinary:requirement(e.member(id,'ordinary')),memberPhysical:requirement(e.member(id,'physical')),keyOrdinary:requirement(e.keyMapping(id,'ordinary')),keyPhysical:requirement(e.keyMapping(id,'physical')),placementOrdinary:requirement(e.placement(id,'ordinary')),placementPhysical:requirement(e.placement(id,'physical'))},maps:surviving});
   }
  }
  verify();result.passed=true;
 }catch(error){result.error=String(error?.stack??error);process.exitCode=1;}finally{Object.defineProperty(Map.prototype,'set',originalDescriptor);connection?.dispose();tree.destroy();save(out,result);}
}
