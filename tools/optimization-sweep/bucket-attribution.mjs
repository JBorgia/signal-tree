#!/usr/bin/env node
// Diagnostic allocation/reachability census. No CPU or retained-byte attribution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { setImmediate as nextJob } from 'node:timers/promises';
import { inspect } from 'node:util';
const runner=fileURLToPath(import.meta.url),[mode,...args]=process.argv.slice(2);
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const fresh=p=>{assert(!existsSync(p));mkdirSync(p,{recursive:true});};
const verify=b=>{for(const[p,h]of Object.entries(b))assert.equal(sha(p),h,`binding ${p}`);};
if(mode==='prepare'){
 const[manifestArg,toolchainArg,outArg]=args,manifestPath=resolve(manifestArg),toolchain=resolve(toolchainArg),out=resolve(outArg),manifest=read(manifestPath);
 const bindings={[runner]:sha(runner),[manifestPath]:sha(manifestPath),[process.execPath]:sha(process.execPath)};
 for(const[p,h]of Object.entries(manifest.files))bindings[join(manifest.root,p)]=h;
 assert.equal(sha(manifest.buildReceipt),manifest.buildReceiptSha256);assert.equal(read(manifest.buildReceipt).exitCode,0);bindings[manifest.buildReceipt]=manifest.buildReceiptSha256;
 verify(bindings);fresh(out);
 const frozenRunner=join(out,'runner.mjs');writeFileSync(frozenRunner,readFileSync(runner),{flag:'wx'});delete bindings[runner];bindings[frozenRunner]=sha(frozenRunner);
 const req=createRequire(join(toolchain,'package.json')),esbuildPath=req.resolve('esbuild'),esbuild=req(esbuildPath),native=createRequire(esbuildPath).resolve(`@esbuild/${process.platform}-${process.arch}/bin/esbuild`);
 assert.equal(process.env.ESBUILD_BINARY_PATH,undefined);
 for(const p of [esbuildPath,native,join(dirname(esbuildPath),'../package.json'),join(toolchain,'pnpm-lock.yaml')])bindings[p]=sha(p);
 const dist=join(manifest.root,'dist'),entry=join(out,'entry.mjs'),bundle=join(out,'bundle.mjs');
 writeFileSync(entry,`export {signalTree} from ${JSON.stringify(join(dist,'lib/signal-tree.js'))};\nexport {entityMap} from ${JSON.stringify(join(dist,'lib/markers/entity-map.js'))};\nexport {transactions} from ${JSON.stringify(join(dist,'enhancers/transactions/transactions.js'))};\nexport {getPathNotifier} from ${JSON.stringify(join(dist,'lib/path-notifier.js'))};\n`,{flag:'wx'});
 const built=await esbuild.build({entryPoints:[entry],outfile:bundle,bundle:true,format:'esm',platform:'node',target:'node24',minify:false,metafile:true,define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'}});
 assert.match(readFileSync(bundle,'utf8'),/function createCaptureBucket\(/,'Diagnostic needs original bucket function name');
 write(join(out,'meta.json'),built.metafile);
 for(const p of [entry,bundle,join(out,'meta.json'),...Object.keys(built.metafile.inputs).map(p=>resolve(p))])bindings[p]=sha(p);
 verify(bindings);write(join(out,'packet.json'),{kind:'bucket-allocation-diagnostic-v2',manifestPath,bundle,bindings,runner:frozenRunner,node:process.version,transactionMethod:read(join(manifest.root,'package.json')).version.startsWith('15.')?'transaction':'transact',limits:'Unminified instrumented diagnostic. Actual constructor calls and weak reachability; not production timing, heap bytes or dominator analysis.'});
 console.log(out);
}else if(mode==='run'){
 const[packetArg,outArg]=args,packet=resolve(packetArg),out=resolve(outArg),prepared=read(join(packet,'packet.json'));verify(prepared.bindings);assert.equal(sha(runner),sha(prepared.runner),'Exact frozen diagnostic');fresh(out);const results=[];
 for(const kind of ['scalar','structural'])for(const control of ['normal','held-positive']){
  const output=join(out,`${kind}-${control}.json`),command=[process.execPath,'--expose-gc',prepared.runner,'child',packet,output,kind,control];
  const child=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:120000});writeFileSync(output+'.log',(child.stdout??'')+(child.stderr??''),{flag:'wx'});
  const record={kind,control,command,exitCode:child.status,signal:child.signal,error:child.error?String(child.error):undefined,result:output,resultSha256:existsSync(output)?sha(output):undefined,logSha256:sha(output+'.log')};results.push(record);write(join(out,`${kind}-${control}-invocation.json`),record);
  assert.equal(child.status,0,child.stderr);assert.equal(read(output).passed,true);
 }
 write(join(out,'results.json'),{passed:true,results});
}else if(mode==='child'){
 const[packetArg,outArg,kind,control]=args,packetPath=join(resolve(packetArg),'packet.json'),packet=read(packetPath);verify(packet.bindings);assert.equal(process.version,packet.node);assert.equal(typeof globalThis.gc,'function');
 assert(['scalar','structural'].includes(kind));assert(['normal','held-positive'].includes(control));
 const{signalTree,entityMap,transactions,getPathNotifier}=await import(pathToFileURL(packet.bundle));
 const lines=readFileSync(packet.bundle,'utf8').split('\n'),OriginalMap=Map,OriginalSet=Set,records=[],held=[];
 const constructorBody=readFileSync(packet.bundle,'utf8').match(/function createCaptureBucket\([^)]*\) \{([\s\S]*?)\n\}/)?.[1];assert(constructorBody,'Bucket definition');
 const expectedConstructors=Object.fromEntries([...constructorBody.matchAll(/(\w+):\s*(?:\/\*.*?\*\/\s*)?new (Map|Set)\(/g)].map(match=>[match[1],match[2]]));assert([7,10].includes(Object.keys(expectedConstructors).length),'Known eager baseline shape');
 const allowed=['entityFootprints','ownWriteSeq','ownerPaths','subjectIds','positionIds','baselineValues','effects','occupancy','orderBoundaries','collectionOrders'];
 const wrap=Target=>new Proxy(Target,{construct(target,values,newTarget){
  const value=Reflect.construct(target,values,newTarget),frame=new Error().stack?.split('\n').find(line=>/at createCaptureBucket\s*\(/.test(line));
  if(frame){const coordinates=frame.match(/:(\d+):(\d+)\)?$/),number=Number(coordinates?.[1]),column=Number(coordinates?.[2]);const label=[...lines[number-1].slice(0,column-1).matchAll(/(\w+):/g)].at(-1)?.[1];assert(allowed.includes(label),`Unknown bucket constructor: ${frame} ${lines[number-1]}`);assert.equal(expectedConstructors[label],Target===OriginalMap?'Map':'Set','Actual constructor site/kind');records.push({label,kind:Target===OriginalMap?'Map':'Set',ref:new WeakRef(value)});if(control==='held-positive')held.push(value);}
  return value;
 }});
 const census=()=>Object.fromEntries(allowed.map(label=>{
  const selected=records.filter(r=>r.label===label);let live=0,empty=0,entries=0;for(const record of selected){const value=record.ref.deref();if(value){live++;empty+=Number(value.size===0);entries+=value.size;}}
  return[label,{constructed:selected.length,live,empty,entries}];
 }));
 const drain=async()=>{getPathNotifier().flushSync();for(let i=0;i<32;i++)await Promise.resolve();};
 const collect=async()=>{for(let i=0;i<4;i++){await nextJob();globalThis.gc();}};
 const result={kind,control,packetPath,packetSha256:sha(packetPath),pid:process.pid,node:process.version,checkpoints:{},passed:false};let tree,handles=[];
 try{
  globalThis.Map=wrap(OriginalMap);globalThis.Set=wrap(OriginalSet);
  tree=signalTree({scalars:Object.fromEntries(Array.from({length:128},(_,i)=>['v'+i,0])),rows:entityMap({selectId:row=>row.id})},{enhancers:[transactions({history:{retain:0}})]});await drain();await collect();
  result.checkpoints.initialized=census();
  for(let i=0;i<128;i++)handles.push(tree[packet.transactionMethod](()=>kind==='scalar'?tree.$.scalars['v'+i](i+1):tree.$.rows.addOne({id:i,value:i+1})));
  await drain();assert.equal(tree.__transactions.getPendingTurnCount(),128);
  if(kind==='scalar')for(let i=0;i<128;i++)assert.equal(tree.$.scalars['v'+i](),i+1);else assert.equal(tree.$.rows.count(),128);
  await collect();result.checkpoints.pending=census();assert(records.length>=128,'Actual capture buckets required');
  const baselineCounts=Object.keys(expectedConstructors).map(label=>result.checkpoints.pending[label].constructed);assert(baselineCounts.every(count=>count===baselineCounts[0]&&count>=128),'All eager baseline constructor sites classified');result.expectedConstructors=expectedConstructors;
  for(let i=0;i<handles.length;i++)if(kind==='scalar'&&i%2)handles[i].rollback();else handles[i].confirm();handles=[];await drain();assert.equal(tree.__transactions.getPendingTurnCount(),0);assert.equal(tree.__transactions.getConfirmedTurnCount(),0);
  if(kind==='scalar')for(let i=0;i<128;i++)assert.equal(tree.$.scalars['v'+i](),i%2?0:i+1);else assert.deepEqual(tree.$.rows.all(),Array.from({length:128},(_,i)=>({id:i,value:i+1})));
  await collect();result.checkpoints.settled=census();tree.destroy();tree=undefined;await drain();await collect();result.checkpoints.destroyed=census();
  if(control==='held-positive'){assert.equal(Object.values(result.checkpoints.destroyed).reduce((n,v)=>n+v.live,0),records.length,'Positive retention must remain detectable');held.length=0;await collect();result.checkpoints.controlReleased=census();assert(Object.values(result.checkpoints.controlReleased).reduce((n,v)=>n+v.live,0)<records.length,'Positive control release must be detectable');}
  verify(packet.bindings);result.passed=true;
 }catch(error){result.error=error instanceof Error?error.stack:inspect(error);process.exitCode=1;}
 finally{globalThis.Map=OriginalMap;globalThis.Set=OriginalSet;try{tree?.destroy();}catch(error){result.cleanupError=inspect(error);result.passed=false;process.exitCode=1;}write(resolve(outArg),result);}
}else throw Error('prepare MANIFEST TOOLCHAIN OUT | run PACKET OUT | child PACKET OUT KIND CONTROL');
