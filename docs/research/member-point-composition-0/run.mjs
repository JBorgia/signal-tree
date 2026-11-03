import {restoreProofHooks} from '../operation-disposition-0/clean-proof-hook-seams.mjs';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'../../..');
const oldRoot='@proof';
const deps=process.env.ST_PROOF_DEPS || root;
const require=createRequire(deps+'/package.json'),{build}=require('esbuild');
const [lane,entry,control='suite',label='first']=process.argv.slice(2);
const lanes={CPRF:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN','MP2','MP3','RK1','CL2','RG1'],CPRE:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN','MP2','MP3','RK1'],CPRD:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN','MP2','MP3'],CPRC:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN','MP2'],CPRB:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN','MP1'],CPRA:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9','CLEAN'],base:[],D2:['D2','T1'],D2I:['D2','T1','I1'],OAP:['D2','S1','M1','A1','T1','OA','PS'],OAPI:['D2','S1','M1','A1','T1','OA','PS','I1'],R0:['D2','S1','M1','A1','T1','OA','PS','I1','R0'],C1:['D2','S1','M1','A1','T1','OA','PS','I1','C1'],CR1:['D2','S1','M1','A1','T1','OA','PS','I1','C1','R0'],CPR1:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1'],CPR10:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8','R9'],CPR9:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7','R8'],CPR8:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6','R7'],CPR7:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R4','R5','R5-route','R6'],CPR6:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R3','R4','R5','R5-route'],CPR5:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R3','R4'],CPR4:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2','R3'],CPR3:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2','R2'],CPR2:['D2','S1','M1','A1','T1','OA','PS','I1','C1','P1','R1','C2']};
if(!lanes[lane])throw Error('Unknown lane');
const probe=[resolve(dir,entry),resolve(dir,'../operation-disposition-0',entry),resolve(dir,'../membership-point-work-0',entry),resolve(dir,'../prepared-selection-order-0',entry),resolve(dir,'../selected-key-restoration-0',entry),resolve(dir,'../shared-projection-publication-0',entry),resolve(dir,'../settlement-publication-boundary-0',entry),resolve(dir,'../operation-record-boundary-0',entry),resolve(dir,'../atomic-capture-boundary-0',entry)].find(existsSync);
if(!/^[a-z0-9-]+\.mjs$/.test(entry)||!probe)throw Error('Unknown probe');
const evidence=process.env.ST_PROOF_OUTPUT || '/private/tmp/st-membership-point-replay';
mkdirSync(evidence,{recursive:true});
const candidate=mkdtempSync(resolve(evidence,lane+'-'));
const base='19a5bd034d5ebef262f637c397bb41fe50a6a1e3';
const git=(args,cwd=root)=>{const r=spawnSync('git',args,{cwd,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout;};
const capture=['../atomic-installation-capture-0/candidate.patch','../atomic-capture-boundary-0/B.patch','../atomic-capture-boundary-0/B2.patch','../atomic-capture-boundary-0/B3.patch','../operation-record-boundary-0/D.patch','../operation-record-boundary-0/D2.patch'];
const patches=lanes[lane].flatMap(x=>x==='D2'?capture:x==='S1'?['../shared-projection-publication-0/S1.patch']:['M1','A1'].includes(x)?['../selected-key-restoration-0/'+x+'.patch']:['T1','OA','PS'].includes(x)?['../prepared-selection-order-0/'+x+'.patch']:x==='I1'?['../membership-point-work-0/I1.patch']:['MP1','MP2','MP3','RK1','CL2','RG1'].includes(x)?[x+'.patch']:x==='CLEAN'?['../operation-disposition-0/CLEAN-unverified.patch']:['../operation-disposition-0/'+x+'.patch']).map(p=>resolve(dir,p));
const files=new Set(patches.flatMap(f=>[...readFileSync(f,'utf8').matchAll(/^--- a\/(.+)$/gm)].map(m=>m[1])));
for(const rel of files){const f=resolve(candidate,rel);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,git(['show',base+':'+rel]));}
for(const patch of patches)git(['apply',patch],candidate);
const exact=resolve(evidence,'exact-base');
const out=resolve(evidence,'runs',`${lane}-${entry}-${control}-${label}`);mkdirSync(out,{recursive:true});
if(existsSync(out+'/manifest.json'))throw Error('Preserve existing run; use new label');
const inputs=[],hash=x=>createHash('sha256').update(x).digest('hex');
const result=await build({entryPoints:[probe],bundle:true,platform:'node',format:'esm',target:'node24',write:false,nodePaths:[deps+'/node_modules'],tsconfigRaw:{compilerOptions:{}},plugins:[{name:'exact-base-candidate',setup(b){
 b.onResolve({filter:/^@signal-tree\/kernel\/adapter$/},()=>({path:root+'/packages/kernel/src/adapter.ts'}));
 b.onResolve({filter:/^@signal-tree\/kernel\/internals$/},()=>({path:root+'/packages/kernel/src/internals.ts'}));
 b.onResolve({filter:/^@signal-tree\/kernel$/},()=>({path:root+'/packages/kernel/src/index.ts'}));
 b.onResolve({filter:/^solid-js$/},()=>({path:require.resolve('solid-js/dist/solid.js')}));
 b.onResolve({filter:/^@proof\//},a=>({path:a.path.replace(oldRoot,root)}));
 b.onLoad({filter:/\.(mjs|js|ts|json)$/},args=>{
  const rel=args.path.startsWith(root+'/')?args.path.slice(root.length+1):undefined;
  const overlay=rel&&resolve(candidate,rel);
  let actual=lane!=='base'&&overlay&&existsSync(overlay)?overlay:args.path;
  if(rel?.startsWith('packages/') && actual===args.path){actual=resolve(exact,rel);mkdirSync(dirname(actual),{recursive:true});writeFileSync(actual,git(['show',base+':'+rel]));}
  const bytes=readFileSync(actual);let contents=bytes.toString();
  // Fault at the common rich entity decomposition entrance, before any effects.
  if(rel==='packages/kernel/src/enhancers/transactions/transactions.ts'){
   if(lanes[lane].includes('CLEAN')) contents=restoreProofHooks(contents);
   const marker='  const captureEffects = (';const start=contents.indexOf(marker);const at=contents.indexOf('    const membership = plainBranchMembershipEffects(meta);',start);
   if(start<0||at<0)throw Error('capture seam missing');
   contents=contents.slice(0,at)+'    (globalThis as any).__entityCaptureProbe?.(path, next, prev, subjectIds);\n'+contents.slice(at);
  }
  if(rel==='packages/kernel/src/enhancers/transactions/transactions.ts') contents=contents.replace('const retained=authority.getPendingTurn(turnId)?.__effects ?? [];', 'const retained=(authority.getPendingTurn(turnId)?.__effects ?? []).filter(e => !(globalThis as any).__dropDisposition?.(e));');
  if(rel==='packages/kernel/src/lib/entity-signal.ts') contents=contents.replace('  function updateSignals(): void {','  function updateSignals(): void {\n    (globalThis as any).__publicationTrace?.("collection:updateSignals");').replace('      deriveLocation(version, (value) => value + 1);','      (globalThis as any).__publicationTrace?.("collection:stage-version");\n      deriveLocation(version, (value) => value + 1);');
  if(rel==='packages/kernel/src/lib/entity-signal.ts') {
   const start=contents.indexOf('  function prepareTransitionTarget(');const end=contents.indexOf('  function readTransitionSource(',start);
   let block=contents.slice(start,end);
   block=block.replace('    return {\n      install(): void {','    (globalThis as any).__selectionTrace?.("prepared", {activeIdBefore, activeSubjectBefore, activeIdAfter});\n    return {\n      install(): void {');
   block=block.replace('          valueStore.installPreparedTargetValues(valueTarget);','          valueStore.installPreparedTargetValues(valueTarget);\n          (globalThis as any).__selectionTrace?.("installed", {activeId: activeIdSignal(), row: getProjectedEntity(activeIdSignal() as K)});');
   block=block.replace('          replaceLocation(activeIdSignal, activeIdAfter);','          replaceLocation(activeIdSignal, activeIdAfter);\n          (globalThis as any).__selectionTrace?.("selection-write", {requested: activeIdAfter ?? null, nativeReadBeforeDelivery: activeIdSignal() ?? null});');

   contents=contents.slice(0,start)+block+contents.slice(end);
  }
  if(rel==='packages/kernel/src/lib/entity-signal.ts') {
   contents=contents.replace('  const activeIdSignal = locations.createCell<K | undefined>(undefined);', '  const activeIdSignal = locations.createCell<K | undefined>(undefined);\n  (globalThis as any).__orderTrace?.("selection-cell", {location: activeIdSignal});');
   contents=contents.replace('    const targetNeighborBySubject = new Map(', '    (globalThis as any).__orderTrace?.("selection-prepared", {activeIdBefore, activeIdAfter});\n    const targetNeighborBySubject = new Map(');
   contents=contents.replace('          valueStore.installPreparedTargetValues(valueTarget);','          valueStore.installPreparedTargetValues(valueTarget);\n          (globalThis as any).__orderTrace?.("rows-installed", {});');
  }
  if(rel==='packages/kernel/src/lib/internals/native-location-realization.ts') {
   contents=contents.replace('      notify: () => realized.token.invalidate(),','      notify: () => { (globalThis as any).__orderTrace?.("native-selection-publication", {location}); realized.token.invalidate(); },');
   contents=contents.replace("        const changed = write(next, 'replace');", "        const changed = write(next, 'replace');\n        (globalThis as any).__orderTrace?.(\"physical-selection-write\", {location, value: next, changed});");
  }
  if(rel==='packages/kernel/src/lib/internals/causal-runtime/target-transition.ts') contents=contents.replace('      completion?.onCommitted();','      (globalThis as any).__orderTrace?.("prepared-unit-installed", {});\n      completion?.onCommitted();');
  if (entry === 'materialization-failure.mjs' && rel==='packages/kernel/src/enhancers/transactions/transactions.ts') contents=contents.replace('    expectedDispositions.set(transactionId, foldOperationDisposition(transactionId));', '    (globalThis as any).__normalizationFault?.();\n    expectedDispositions.set(transactionId, foldOperationDisposition(transactionId));');
  if (entry === 'operation-work.mjs') {
  if(rel==='packages/kernel/src/enhancers/transactions/transactions.ts') {
   const hit=(key,n='1')=>`(globalThis as any).__work?.('${key}',${n})`;
   contents=contents.replaceAll('[...records,operation]',`(${hit('journalElementsCopied','records.length')}, [...records,operation])`);
   contents=contents.replaceAll('value:operation}',`value:(${hit('journalLinkedAppend')},operation)}`);
   contents=contents.replace('if(effect) scratch.effects.set(key, cloneTurnEffect(effect));',`if(effect) scratch.effects.set(key, (${hit('scratchEffectsCopied')}, cloneTurnEffect(effect)));`);
   contents=contents.replace('scratch.baselineValues.set(key,value);',`scratch.baselineValues.set(key,(${hit('scratchBaselineCopied')},value));`);
   contents=contents.replace('if (prior) scratch.effects.set(key, cloneTurnEffect(prior));',`if (prior) scratch.effects.set(key, (${hit('scratchEffectsCopied')},cloneTurnEffect(prior)));`);
   contents=contents.replace('scratch.baselineValues.set(effect.position, bucket.baselineValues.get(effect.position));',`scratch.baselineValues.set(effect.position,(${hit('scratchBaselineCopied')},bucket.baselineValues.get(effect.position)));`);
   contents=contents.replaceAll('if(!scratch.effects.has(key))',`if((${hit('scratchKeysExamined')},!scratch.effects.has(key)))`);
   contents=contents.replaceAll('return {writes,adds:',`(globalThis as any).__work?.('preparedMapWrites',writes.length); return {writes,adds:`);
   contents=contents.replace('retained.find(e=>effectKey(e)===effectKey(effect))',`retained.find(e=>(${hit('dispositionComparisons')},effectKey(e)===effectKey(effect)))`);
   contents=contents.replace('const actual=indexed.get(effectKey(effect));',`const actual=(${hit('dispositionLookups')},indexed.get(effectKey(effect)));`);
   contents=contents.replace('retained.map(effect => [effectKey(effect), effect])',`retained.map(effect => (${hit('dispositionIndexEntries')},[effectKey(effect), effect]))`);
  }
  }
  inputs.push({path:actual,resolvedAs:args.path,sha256:hash(bytes),loadedSha256:hash(contents)});
  return {contents,loader:extname(args.path)==='.ts'?'ts':extname(args.path)==='.json'?'json':'js',resolveDir:dirname(args.path)};
 });
}}]});
writeFileSync(out+'/bundle.mjs',result.outputFiles[0].text);
const r=spawnSync(process.execPath,[out+'/bundle.mjs',control],{encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024});
writeFileSync(out+'/stdout.json',r.stdout);writeFileSync(out+'/stderr.txt',r.stderr);
const stable=inputs.every(i=>hash(readFileSync(i.path))===i.sha256);
writeFileSync(out+'/manifest.json',JSON.stringify({node:process.version,base:'19a5bd03',lane,entry,control,exit:r.status,signal:r.signal,stable,inputs,bundle:hash(result.outputFiles[0].text)},null,2));
console.log(JSON.stringify({lane,entry,control,exit:r.status,stable,out}));process.exitCode=r.status===0&&stable?0:1;
