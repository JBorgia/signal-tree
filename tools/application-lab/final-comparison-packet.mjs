#!/usr/bin/env node
// Prepare verified installed inputs only. No build, test, browser or benchmark.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync,existsSync,mkdirSync,readdirSync,readFileSync,realpathSync,symlinkSync,writeFileSync } from 'node:fs';
import { dirname,join,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
const [configArg,outArg]=process.argv.slice(2);assert(configArg&&outArg);
const configPath=resolve(configArg),out=resolve(outArg),runner=fileURLToPath(import.meta.url);
const protocol=join(dirname(runner),'final-comparison-rerun-protocol.md');
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const config=read(configPath),baseline=realpathSync(config.baselinePacket),oldPlanPath=join(baseline,'plan.json'),old=read(oldPlanPath);
assert(!existsSync(out),'Preserve previous packets');assert.equal(process.version,'v24.15.0');
const bindings={...old.inputs,[oldPlanPath]:sha(oldPlanPath),[configPath]:sha(configPath),[runner]:sha(runner),[protocol]:sha(protocol)};
const verify=values=>{for(const[p,h]of Object.entries(values))assert.equal(sha(p),h,`Input drift: ${p}`);};
const bind=(p,h=sha(p))=>{if(bindings[p])assert.equal(bindings[p],h,`Conflicting binding ${p}`);bindings[p]=h;};
for(const filename of ['build.json','dispatch-build.json']){
 const p=join(baseline,filename),build=read(p);assert.equal(build.planSha256,sha(oldPlanPath));bind(p);
 for(const arm of Object.values(build.arms))for(const[p,h]of Object.entries(arm.dependencies))bind(p,h);
}
const variants=realpathSync(config.baselineVariantPacket),variantPlanPath=join(variants,'plan.json'),variantPlan=read(variantPlanPath);
assert.equal(variantPlan.variant.baselinePlanSha256,sha(oldPlanPath));verify(variantPlan.inputs);bind(variantPlanPath);for(const[p,h]of Object.entries(variantPlan.inputs))bind(p,h);
for(const[name,version]of Object.entries(config.pinnedDependencies))assert.equal(read(join(old.toolchainDirectory,'node_modules',name,'package.json')).version,version);
const files=root=>readdirSync(root,{withFileTypes:true}).flatMap(e=>{const p=join(root,e.name);assert(!e.isSymbolicLink());return e.isDirectory()?files(p):[p];}).sort();
const kernels={};
for(const line of ['v15','v16']){
 const chosen=config.finalKernels[line],receiptPath=resolve(chosen.receipt),receipt=read(receiptPath);assert.equal(sha(receiptPath),chosen.receiptSha256);bind(receiptPath);
 assert.equal(receipt.runtimeCommit??receipt.commit,chosen.sourceCommit);
 let payload=receipt;for(const key of chosen.payloadKeys)payload=payload[key];
 const root=realpathSync(chosen.packageRoot),expected={};
 for(const[k,h]of Object.entries(payload)){
  const relative=chosen.keyPrefix?(k.startsWith(chosen.keyPrefix)?k.slice(chosen.keyPrefix.length):null):k;
  if(relative===null)continue;assert(!relative.startsWith('/')&&!relative.split('/').includes('..'));expected[relative]=h;
 }
 assert(Object.keys(expected).length>50);assert.deepEqual(files(root).map(p=>p.slice(root.length+1)).sort(),Object.keys(expected).sort());
 for(const[p,h]of Object.entries(expected))bind(join(root,p),h);
 const pkg=read(join(root,'package.json'));assert.equal(pkg.name,'@signal-tree/kernel');assert.equal(pkg.version,read(join(baseline,line,'node_modules/@signal-tree/kernel/package.json')).version);
 const facadeRoot=join(baseline,line,'node_modules/@signal-tree/angular'),facade=read(join(facadeRoot,'package.json'));
 assert.equal(facade.dependencies['@signal-tree/kernel'],pkg.version);
 const checked=realpathSync(config.facades[line].currentBuiltRoot);
 const packaged=files(facadeRoot).map(p=>p.slice(facadeRoot.length+1)),built=files(checked).map(p=>p.slice(checked.length+1));
 assert.deepEqual(built.filter(p=>!packaged.includes(p)),['dist/index.d.ts'],'Unexpected extra built facade payload');
 assert.deepEqual(packaged.filter(p=>!built.includes(p)),[]);
 assert.equal(readFileSync(join(checked,'dist/index.d.ts'),'utf8'),'export * from "./src/index";\n');
 assert.equal(facade.types,'./src/index.d.ts');assert.equal(facade.exports['.'].types,'./src/index.d.ts');
 assert.deepEqual(facade.files,['dist/**/*.js','src/**/*.d.ts','README.md','LICENSE','NOTICE','llms.txt']);
 bind(join(checked,'dist/index.d.ts'));
 for(const p of files(facadeRoot)){const counterpart=join(checked,p.slice(facadeRoot.length+1));assert.equal(sha(counterpart),sha(p),'Facade payload changed; requalify its own exact artifact');bind(counterpart);}
 const sourceRoot=config.facades[line].sourceRoot,sourceBaseline=config.facades[line].sourceBaseline;
 const diff=spawnSync('git',['-C',sourceRoot,'diff',sourceBaseline,'--','packages/angular'],{encoding:'utf8'});assert.equal(diff.status,0,diff.stderr);assert.equal(diff.stdout,'','Facade source differs from pinned artifact');
 kernels[line]={root,expected,sourceCommit:chosen.sourceCommit,receiptPath,pkg};
}
assert.equal(sha(config.facadeInspection.path),config.facadeInspection.sha256);bind(config.facadeInspection.path);
verify(bindings);mkdirSync(out,{recursive:true});const inputs={...bindings},identities={},artifacts={};
const copy=(source,destination)=>{mkdirSync(dirname(destination),{recursive:true});copyFileSync(source,destination);inputs[destination]=sha(destination);};
const archiveOld=(artifact,name)=>{
 assert.equal('sha512-'+createHash('sha512').update(readFileSync(artifact.archive)).digest('base64'),artifact.integrity);
 const path=join(out,'archives',name+'.tgz');copy(artifact.archive,path);return{...artifact,archive:path};
};
for(const[line,kernel]of Object.entries(kernels)){
 const snapshot=join(out,'package-snapshots',line,'package');
 for(const relative of Object.keys(kernel.expected))copy(join(kernel.root,relative),join(snapshot,relative));
 const archive=join(out,'archives',line+'-final-kernel.tgz');mkdirSync(dirname(archive),{recursive:true});
 const packed=spawnSync('tar',['-czf',archive,'-C',dirname(snapshot),'package'],{encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);inputs[archive]=sha(archive);
 artifacts[line+'-kernel']={archive,integrity:'sha512-'+createHash('sha512').update(readFileSync(archive)).digest('base64'),sourceCommit:kernel.sourceCommit,sourceReceipt:kernel.receiptPath,developmentArtifact:true,note:'Exact validated payload snapshot; package version unchanged; not a registry publication receipt.'};
 artifacts[line+'-angular']=archiveOld(old.artifacts[line+'-angular'],line+'-angular');
 artifacts[line+'-before-kernel']=archiveOld(old.artifacts[line+'-kernel'],line+'-before-kernel');
 artifacts[line+'-before-angular']=archiveOld(old.artifacts[line+'-angular'],line+'-before-angular');
}
const arms=['v15-before','v16-before','tanstack','v15','v16','tanstack-variant','native','ngrx'];
for(const arm of arms){
 const sourceArm=arm==='tanstack-variant'?'tanstack':arm.replace('-before','');
 const sourceRoot=join(baseline,sourceArm),destinationRoot=join(out,arm);
 for(const[p,h]of Object.entries(bindings)){
  const actual=realpathSync(p);if(!actual.startsWith(sourceRoot+sep)||actual.includes(sep+'node_modules'+sep))continue;
  // Build receipts may bind generated source only; never copy served bundles as a new build.
  const relative=actual.slice(sourceRoot.length+1);if(relative.startsWith('dist/'))continue;
  copy(actual,join(destinationRoot,relative));assert.equal(inputs[join(destinationRoot,relative)],h);
 }
 const deps=join(destinationRoot,'node_modules');mkdirSync(deps,{recursive:true});
 for(const name of readdirSync(join(old.toolchainDirectory,'node_modules')))if(name!=='@signal-tree')symlinkSync(join(old.toolchainDirectory,'node_modules',name),join(deps,name));
 if(sourceArm==='v15'||sourceArm==='v16'){
  const kernel=arm.endsWith('-before')?join(baseline,sourceArm,'node_modules/@signal-tree/kernel'):kernels[sourceArm].root;
  for(const[part,root]of [['kernel',kernel],['angular',join(baseline,sourceArm,'node_modules/@signal-tree/angular')]])for(const p of files(root))copy(p,join(deps,'@signal-tree',part,p.slice(root.length+1)));
  identities[arm]={implementation:'SignalTree Angular facade',line:sourceArm,revision:arm.endsWith('-before')?'before':'final',kernelArtifact:arm+'-kernel',facadeArtifact:arm+'-angular',consumerSource:sourceArm};
 }else identities[arm]={implementation:sourceArm,revision:arm==='tanstack-variant'?'private-application-variant':'original',consumerSource:sourceArm};
 if(arm==='tanstack-variant')for(const filename of ['selected.ts','selected-dispatch.ts'])copy(join(variants,'tanstack/src/arms',filename),join(destinationRoot,'src/arms',filename));
 for(const relative of ['src/main.ts','src/dispatch-main.ts','src/model.ts','src/dispatch-model.ts','src/dispatch-backend.ts','src/arm.ts','src/dispatch-arm.ts','src/index.html','src/dispatch.html','package.json','tsconfig.json','angular.json'])assert.equal(sha(join(destinationRoot,relative)),sha(join(sourceRoot,relative)),`Common fixture changed: ${arm}/${relative}`);
}
verify(bindings);verify(inputs);
save(join(out,'plan.json'),{...old,createdUTC:new Date().toISOString(),arms,artifacts,inputs,node:process.version,host:{platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},phase:'Final runtime and private application comparison packet; unbuilt, unqualified, unpublished.',runtimeRefresh:{command:[process.execPath,...process.argv.slice(1)],baselinePlanPath:oldPlanPath,baselinePlanSha256:sha(oldPlanPath),variantPlanPath,variantPlanSha256:sha(variantPlanPath),configPath,configSha256:sha(configPath),identities,limits:'Aliases identify actual before/final package payloads. Common application/UI/oracle sources unchanged; no registry or semantic-equivalence claim.'}});
console.log(out);
