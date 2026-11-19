const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {TraceMap,originalPositionFor}=require('/Users/jonathanborgia/code/signaltree/node_modules/.pnpm/@jridgewell+trace-mapping@0.3.31/node_modules/@jridgewell/trace-mapping');
const root=__dirname,hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const results=JSON.parse(fs.readFileSync(path.join(root,'STATUS.json'),'utf8'));if(results.length!==2)throw Error('Incomplete pair');
const summaries=[];
for(const result of results){
 if(result.exit||result.remainingOwned.length||result.runtimeMismatches.length||!result.validTwoCasesAndFreshWorker)throw Error('Run invalid');
 const d=path.join(root,'runs',result.arm+'-2048-r1'),indices=JSON.parse(fs.readFileSync(path.join(d,'SCRIPT-INDEX.json'),'utf8')),maps=new Map(),sourceChecks=[];
 for(const item of indices){
  const url=item.meta?.sourceMapURL;
  if(!url?.startsWith('data:application/json;base64,'))continue;
  const map=JSON.parse(Buffer.from(url.split(',')[1],'base64').toString());maps.set(item.id,new TraceMap(map));
  for(let i=0;i<map.sources.length;i++){
   const target=path.resolve(path.dirname(item.url),map.sources[i]);const source=map.sourcesContent?.[i];
   const exists=fs.existsSync(target);const same=exists&&source!==undefined&&fs.readFileSync(target,'utf8')===source;
   sourceChecks.push({scriptId:item.id,source:target,sourceContentSha256:source===undefined?null:hash(source),matchesCapturedFile:same});
  }
 }
 fs.writeFileSync(path.join(d,'SOURCE-MAP-CHECKS.json'),JSON.stringify(sourceChecks,null,2));
 for(const stage of ['replacement','undo','redo']){
  const file=path.join(d,stage+'.heapprofile.json'),raw=fs.readFileSync(file),profile=JSON.parse(raw),nodes=new Map();let selfTotal=0;
  function walk(node,parents){
   const frame=node.callFrame,map=maps.get(frame.scriptId);let mapped=null;
   if(map&&frame.lineNumber>=0&&frame.columnNumber>=0){mapped=originalPositionFor(map,{line:frame.lineNumber+1,column:frame.columnNumber});}
   const mappedFrame={raw:frame,mapped};const stack=[...parents,mappedFrame];nodes.set(node.id,{nodeId:node.id,selfSize:node.selfSize,stack,sampleBytes:0,sampleCount:0});selfTotal+=node.selfSize;
   for(const child of node.children??[])walk(child,stack);
  }
  walk(profile.head,[]);let total=0;
  for(const sample of profile.samples){const node=nodes.get(sample.nodeId);if(!node)throw Error('Unresolved sample node');node.sampleBytes+=sample.size;node.sampleCount++;total+=sample.size;}
  const leaves=[...nodes.values()].filter(x=>x.sampleCount);const families=new Map(),leafClasses=new Map();
  for(const node of leaves){
   const leaf=node.stack.at(-1),url=leaf.raw.url;
   const leafClass=url.includes('/packages/kernel/')?(leaf.mapped?.source?'candidate-mapped':'candidate-unmapped'):url.includes('harness.mjs')?'diagnostic-harness':url.startsWith('node:')?'node-runtime':url?'external-runtime':'builtin-or-unmapped';
   leafClasses.set(leafClass,(leafClasses.get(leafClass)??0)+node.sampleBytes);
   const owner=[...node.stack].reverse().find(x=>x.raw.url.includes('/packages/kernel/')&&x.mapped?.source);
   const family=owner?owner.raw.url.split('/packages/kernel/')[1]:'no-mapped-candidate-caller';
   node.nearestMappedCandidateCaller=owner??null;node.leafClass=leafClass;
   families.set(family,(families.get(family)??0)+node.sampleBytes);
  }
  leaves.sort((a,b)=>b.sampleBytes-a.sampleBytes);
  fs.writeFileSync(path.join(d,stage+'.attribution.json'),JSON.stringify({note:'Each sample counted once at its leaf. Nearest mapped candidate caller is stack association, not byte ownership proof. Function call-frame positions are not exact allocation instructions.',profileSha256:hash(raw),nodes:leaves},null,2));
  const summary={arm:result.arm,stage,sampleCount:profile.samples.length,estimatedSampleBytes:total,selfSizeSumCrossCheck:selfTotal,totalsEqual:total===selfTotal,profileBytes:raw.length,leafClasses:Object.fromEntries(leafClasses),nearestMappedCandidateCallerBytes:Object.fromEntries([...families].sort((a,b)=>b[1]-a[1])),topStacks:leaves.slice(0,12).map(x=>({nodeId:x.nodeId,sampleBytes:x.sampleBytes,sampleCount:x.sampleCount,leaf:x.stack.at(-1),nearestCaller:x.nearestMappedCandidateCaller}))};
  summaries.push(summary);
 }
}
fs.writeFileSync(path.join(root,'ALLOCATION-SUMMARY.json'),JSON.stringify(summaries,null,2));
for(const s of summaries)console.log(s.arm,s.stage,'samples',s.sampleCount,'estimatedBytes',s.estimatedSampleBytes,'crosscheck',s.totalsEqual,'top5',JSON.stringify(Object.entries(s.nearestMappedCandidateCallerBytes).slice(0,5)));
