#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
const [mode,inputArg,outputArg,sampleText]=process.argv.slice(2);
assert.ok(['build','pilot','control','compare','child'].includes(mode)&&inputArg&&outputArg);
const runner=fileURLToPath(import.meta.url),protocol=join(dirname(runner),'terminal-deep-history-protocol.md');
const input=resolve(inputArg),output=resolve(outputArg);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const verifyBindings=bindings=>{for(const[p,h]of Object.entries(bindings))assert.equal(sha(p),h,`Input drift: ${p}`);};
if(mode==='build'){
  assert(!existsSync(output));const config=read(input);assert(config.arms.length===3);
  assert.deepEqual(config.arms.map(x=>x.name),['a35','source145','final']);
  mkdirSync(output,{recursive:true});const summaries=[];
  for(const arm of config.arms){
    const reportPath=resolve(arm.pendingBundles,'bundles.json');
    const prior=read(reportPath).summaries.find(x=>x.arm==='lazy');assert(prior);
    assert.equal(sha(prior.bundle),prior.bundleSha256);assert.equal(sha(prior.source),prior.sourceSha256);assert.equal(sha(prior.planPath),prior.planSha256);
    assert.equal('sha512-'+createHash('sha512').update(readFileSync(prior.archive)).digest('base64'),prior.archiveIntegrity);
    const plan=read(prior.planPath),root=prior.root,pkg=read(join(root,'package.json'));
    assert.equal(arm.sourceCommit,plan.sourceHead,'Configured revision must match bound package plan');
    assert.equal(prior.archiveIntegrity,plan.artifacts['v16-kernel'].integrity,'Summary archive must belong to bound plan');
    assert.equal(prior.sourceSeal,plan.artifacts['v16-kernel'].sourceSeal,'Summary source seal must belong to bound plan');
    if(arm.archiveIntegrity!==undefined)assert.equal(prior.archiveIntegrity,arm.archiveIntegrity);
    if(arm.sourceSeal!==undefined)assert.equal(prior.sourceSeal,arm.sourceSeal);
    const entry=resolve(root,pkg.exports['.'].import),internals=resolve(root,pkg.exports['./internals'].import),lifecycle=join(root,'dist/lib/experimental-publication/lifecycle.js');
    const source=join(output,arm.name+'.entry.mjs'),bundle=join(output,arm.name+'.production.mjs');
    writeFileSync(source,`export {signalTree,entityMap,transactions,link,leaf} from ${JSON.stringify(entry)};\nexport {transactionLifecycleReader} from ${JSON.stringify(internals)};\nexport {nativeProof,nativeRequirementReady,pendingOwners} from ${JSON.stringify(lifecycle)};\n`,{flag:'wx'});
    const {build,version}=createRequire(join(plan.toolchainDirectory,'package.json'))('esbuild');
    const built=await build({entryPoints:[source],outfile:bundle,bundle:true,minify:true,treeShaking:true,format:'esm',platform:'browser',target:'es2022',define:{ngDevMode:'false','process.env.NODE_ENV':'"production"'},external:['@angular/*','rxjs','rxjs/*','tslib'],metafile:true,logLevel:'silent'});
    const metaPath=join(output,arm.name+'.metafile.json');save(metaPath,built.metafile);
    const packageInputs={};for(const p of Object.keys(built.metafile.inputs)){const absolute=resolve(p);if(absolute.startsWith(root+'/'))packageInputs[absolute]=sha(absolute);}
    assert(Object.keys(packageInputs).length>0);
    assert.equal(Object.keys(packageInputs).filter(p=>p.endsWith('/experimental-publication/lifecycle.js')).length,1,'One native lifecycle authority');
    const archiveIndex=spawnSync('python3',['-c','import tarfile,hashlib,json,sys; t=tarfile.open(sys.argv[1]); print(json.dumps({m.name:hashlib.sha256(t.extractfile(m).read()).hexdigest() for m in t.getmembers() if m.isfile()}))',prior.archive],{encoding:'utf8'});
    assert.equal(archiveIndex.status,0,archiveIndex.stderr);const archived=JSON.parse(archiveIndex.stdout);
    for(const[p,h]of Object.entries(packageInputs))assert.equal(archived['package/'+p.slice(root.length+1)],h,`Installed module differs from verified archive: ${p}`);
    assert.equal(archived['package/package.json'],sha(join(root,'package.json')));
    const bindings=Object.fromEntries([reportPath,prior.bundle,prior.source,prior.planPath,prior.archive,join(root,'package.json'),source,bundle,metaPath].map(p=>[p,sha(p)]));
    Object.assign(bindings,packageInputs);
    summaries.push({name:arm.name,sourceCommit:arm.sourceCommit,sourceSeal:prior.sourceSeal,packageRoot:root,source,bundle,bundleSha256:sha(bundle),esbuild:version,bindings});
  }
  save(join(output,'bundles.json'),{createdUTC:new Date().toISOString(),command:[process.execPath,...process.argv.slice(1)],runnerSha256:sha(runner),protocolSha256:sha(protocol),configPath:input,configSha256:sha(input),excluded:config.excluded??[],summaries});
}else if(mode!=='child'){
  const reportPath=join(input,'bundles.json'),report=read(reportPath);assert.equal(sha(report.configPath),report.configSha256,'Configured artifact drift');assert.equal(sha(runner),report.runnerSha256);assert.equal(sha(protocol),report.protocolSha256);
  for(const arm of report.summaries)verifyBindings(arm.bindings);
  assert(!existsSync(output));mkdirSync(output,{recursive:true});const schedule=[];
  if(mode==='control')for(const fault of ['skip-populate','early-send','skip-native-input'])schedule.push({arm:'a35',profile:'homogeneous',repeat:0,fault,small:true});
  else for(const profile of ['homogeneous','distinct-batch'])for(let repeat=0;repeat<(mode==='pilot'?1:5);repeat++){
    const names=['a35','source145','final'];const rotated=names.slice(repeat%3).concat(names.slice(0,repeat%3));
    for(const arm of repeat%2?rotated.reverse():rotated)schedule.push({arm,profile,repeat});
  }
  const bindings={[runner]:sha(runner),[protocol]:sha(protocol),[reportPath]:sha(reportPath),[report.configPath]:sha(report.configPath)};
  for(const arm of report.summaries)Object.assign(bindings,arm.bindings);
  save(join(output,'schedule.json'),{createdUTC:new Date().toISOString(),command:[process.execPath,...process.argv.slice(1)],mode,bindings,schedule});
  const results=[];
  for(const[index,sample]of schedule.entries()){
    const path=join(output,`child-${index}.json`),args=['--expose-gc',runner,'child',input,path,JSON.stringify(sample)];
    const child=spawnSync(process.execPath,args,{encoding:'utf8',timeout:300000,env:{...process.env,NODE_ENV:'production'}});
    writeFileSync(path+'.log',(child.stdout??'')+(child.stderr??''),{flag:'wx'});
    save(join(output,`invocation-${index}.json`),{command:[process.execPath,...args],status:child.status,signal:child.signal,resultSha256:existsSync(path)?sha(path):null,logSha256:sha(path+'.log')});
    const result=existsSync(path)?read(path):{sample,passed:false,error:'No child result'};results.push(result);
    console.log(index+1,schedule.length,JSON.stringify(sample),result.passed?'passed':result.error);
    if(mode==='control'){
      assert.equal(child.status,1);assert.match(result.error,sample.fault==='skip-populate'?/Populated rows/:sample.fault==='early-send'?/No outbound delivery before settlement/:/Independent declaration must contradict/);
    }else if(child.status!==0||!result.passed)break;
  }
  verifyBindings(bindings);
  const passed=results.length===schedule.length&&(mode==='control'||results.every(x=>x.passed));
  save(join(output,'results.json'),{passed,mode,scheduleSha256:sha(join(output,'schedule.json')),results});if(!passed)process.exitCode=1;
}else{
  const sample=JSON.parse(sampleText),reportPath=join(input,'bundles.json'),report=read(reportPath),arm=report.summaries.find(x=>x.name===sample.arm);assert(arm);
  assert.equal(sha(report.configPath),report.configSha256,'Configured artifact drift');assert.equal(sha(runner),report.runnerSha256);assert.equal(sha(protocol),report.protocolSha256);verifyBindings(arm.bindings);assert.equal(typeof global.gc,'function');
  const api=await import(pathToFileURL(arm.bundle));
  const result={sample,pid:process.pid,node:process.version,arm:arm.name,sourceCommit:arm.sourceCommit,sourceSeal:arm.sourceSeal,bundleSha256:arm.bundleSha256,host:{cpu:os.cpus()[0].model,load:os.loadavg()},phases:{},checkpoints:[],passed:false};
  const flush=async()=>{for(let i=0;i<160;i++)await Promise.resolve();};
  const gc=async()=>{for(let i=0;i<3;i++){await new Promise(done=>setImmediate(done));global.gc();}return process.memoryUsage().heapUsed;};
  const elapsed=(start,cpu,heap)=>{const used=process.cpuUsage(cpu);return{elapsedMs:performance.now()-start,cpuUserMs:used.user/1000,cpuSystemMs:used.system/1000,cpuMs:(used.user+used.system)/1000,immediateHeapDeltaBytes:process.memoryUsage().heapUsed-heap};};
  const sync=(name,fn)=>{const heap=process.memoryUsage().heapUsed,cpu=process.cpuUsage(),start=performance.now();try{return fn();}finally{result.phases[name]=elapsed(start,cpu,heap);}};
  const asyncPhase=async(name,fn)=>{const heap=process.memoryUsage().heapUsed,cpu=process.cpuUsage(),start=performance.now();try{return await fn();}finally{result.phases[name]=elapsed(start,cpu,heap);}};
  const binding=node=>{const key=Object.getOwnPropertySymbols(node).find(s=>s.description==='signaltree.entityPublication');assert(key);return node[key];};
  const makeRows=(count,cycle)=>Array.from({length:count},(_,i)=>({id:`R-${i}`,value:cycle*100000+i,f1:i+1,f2:i+2,f3:i+3,f4:i+4,f5:i+5,f6:i+6,f7:i+7}));
  const pending=tree=>api.transactionLifecycleReader(tree).snapshot().pending.length;
  async function workload(){
    const tree=sync('setup-tree',()=>api.signalTree({rows:api.entityMap({selectId:r=>r.id})},{enhancers:[api.transactions()]}));
    const rows=tree.$.rows,source=binding(rows).source,outbound=[];
    const connection=sync('setup-active-link',()=>api.link(rows,{set:value=>outbound.push(value)}));
    const owned=[],connections=[],ids=[];let held,field,before,after,firstNegative,firstSubject;
    const tokens=new WeakMap();let nextToken=1;const token=object=>{assert(object&&typeof object==='object');let value=tokens.get(object);if(value===undefined){value=nextToken++;tokens.set(object,value);}return value;};
    const roleNames=['owners','destination','input','validation','possible'];
    const flags=['unknown','invalid','unavailableInput','historicalWindow'];
    const proofSummary=requirement=>{const proof=api.nativeProof(requirement);return{roles:Object.fromEntries(roleNames.map(role=>[role,(proof[role]??[]).map(cell=>({token:token(cell),owner:cell.owner,id:cell.id,outcome:cell.outcome})).sort((a,b)=>a.token-b.token)])),flags:Object.fromEntries(flags.map(flag=>[flag,!!proof[flag]])),terminalRejectedRoles:proof.terminalRejectedRoles??0};};
    const facets=id=>{const e=source.evidence();return[e.member(id,'ordinary'),e.member(id,'physical'),e.placement(id,'physical'),e.keyMapping(id,'ordinary'),e.keyMapping(id,'physical')];};
    const expectedFacts=new Map(),expectedProofs=new Map(),tuplePool=new Map(),expectedOwner=new Map();
    const pendingIdentity=cycleIds=>{const pendingView=api.transactionLifecycleReader(tree).snapshot().pending;assert.equal(pendingView.length,1);const cells=api.pendingOwners();assert.equal(cells.length,1);assert.equal(cells[0].id,pendingView[0].transactionId);assert.equal(cells[0].outcome,'pending');const owner=token(cells[0]);for(const id of cycleIds){assert(api.nativeProof(facets(id)[0]).destination?.some(cell=>token(cell)===owner),'Each pending lifetime carries its actual transaction destination');expectedOwner.set(id,owner);}};
    const captureFacetIdentities=cycleIds=>{for(const id of cycleIds){const ids=facets(id).map(token),key=ids.join(',');let tuple=tuplePool.get(key);if(!tuple){tuple=ids;tuplePool.set(key,tuple);}expectedFacts.set(id,tuple);}};
    const freezeReady=cycleIds=>{for(const id of cycleIds){const values=facets(id);assert.deepEqual(values.map(token),expectedFacts.get(id),'Requirement references survive first drain');for(const req of values){assert(api.nativeRequirementReady(req),'Terminal requirement must be ready before proof baseline');const t=token(req),summary=proofSummary(req);if(expectedProofs.has(t))assert.deepEqual(summary,expectedProofs.get(t));else expectedProofs.set(t,summary);}assert(proofSummary(values[0]).roles.destination.some(cell=>cell.token===expectedOwner.get(id)&&cell.outcome==='rolled-back'),'Actual pending destination is the same rolled-back cell');}};
    const union=()=>({roles:Object.fromEntries(roleNames.map(role=>[role,new Map()])),flags:Object.fromEntries(flags.map(flag=>[flag,false])),terminalRejectedRoles:0});
    const addProof=(target,summary)=>{for(const role of roleNames)for(const cell of summary.roles[role])target.roles[role].set(cell.token,cell);for(const flag of flags)target.flags[flag] ||= summary.flags[flag];target.terminalRejectedRoles |= summary.terminalRejectedRoles;};
    const plainUnion=value=>({roles:Object.fromEntries(roleNames.map(role=>[role,[...value.roles[role].values()].sort((a,b)=>a.token-b.token)])),flags:value.flags,terminalRejectedRoles:value.terminalRejectedRoles});
    const captureSummary=capture=>{const combined=union();assert(Array.isArray(capture?.native));for(const input of capture.native)addProof(combined,proofSummary(input.requirement));return plainUnion(combined);};
    const checkCoverage=stage=>{const expected=union();for(const[id,identities]of expectedFacts){const values=facets(id);assert.deepEqual(values.map(token),identities,'Historical facet identity coverage');for(const req of values){assert(api.nativeRequirementReady(req));assert.deepEqual(proofSummary(req),expectedProofs.get(token(req)),'Historical role/cell/flag coverage');}addProof(expected,proofSummary(values[1]));addProof(expected,proofSummary(values[2]));}const actual=source.captureInput();const combined=plainUnion(expected);assert.deepEqual(captureSummary(actual),combined,'Whole capture covers every physical member and placement');result.coverage??=[];result.coverage.push({stage,subjects:expectedFacts.size,facets:expectedFacts.size*5,uniqueRequirements:expectedProofs.size,uniqueTuples:tuplePool.size,roleCellCounts:Object.fromEntries(roleNames.map(role=>[role,combined.roles[role].length])),flags:combined.flags,terminalRejectedRoles:combined.terminalRejectedRoles,proofDigest:createHash('sha256').update(JSON.stringify(combined)).digest('hex')});return combined;};
    const checkpoint=async(name)=>{const heapBytes=await gc();const publication=source.inspect();result.checkpoints.push({name,heapBytes,publication,pending:pending(tree)});};
    const physicalAbsent=()=>{for(const id of ids)assert.equal(rows.__inspectSubjectResources(id),undefined);assert.deepEqual(rows.__listSubjectReclamationCandidates(),[]);};
    try{
      await flush();assert.deepEqual(outbound,[]);await checkpoint('empty');
      await asyncPhase('aging',async()=>{
        if(sample.profile==='homogeneous'){
          const count=sample.small?10:1000,cycles=sample.small?3:10;
          for(let cycle=1;cycle<=cycles;cycle++){
            const values=makeRows(count,cycle),sentBefore=outbound.length;
            const tx=tree.transact(()=>{if(sample.fault!=='skip-populate')rows.setAll(values);});
            assert.deepEqual(rows.all(),values,'Populated rows must match');assert.equal(pending(tree),1);const cycleIds=[...rows.__subjectIds];ids.push(...cycleIds);pendingIdentity(cycleIds);
            if(cycle===1){held=rows.byIdOrFail('R-0');field=held.value;firstSubject=binding(held).subject;before=tree.$();assert.deepEqual(before.rows.all,values);}
            await flush();if(sample.fault==='early-send')outbound.push(values);assert.equal(outbound.length,sentBefore,'No outbound delivery before settlement');
            tx.rollback();captureFacetIdentities(cycleIds);await flush();await connection.settled();freezeReady(cycleIds);assert.deepEqual(rows.all(),[]);assert.equal(pending(tree),0);assert(outbound.length>=1);assert(outbound.every(v=>Array.isArray(v)&&v.length===0));
            if(cycle===1)firstNegative=token(source.evidence().member(firstSubject,'ordinary'));
          }
        }else{
          const values=makeRows(256,1),cycleIds=[],offers=[],own=Object.getOwnPropertyDescriptor(source,'requestRetirement'),request=source.requestRetirement;
          assert.equal(typeof request,'function');
          Object.defineProperty(source,'requestRetirement',{configurable:true,writable:true,value:function(subject,eligible){offers.push(subject);return Reflect.apply(request,this,[subject,eligible]);}});
          try{
            const tx=tree.transact(()=>{for(let i=0;i<values.length;i++){rows.addOne(values[i]);const added=[...rows.__subjectIds];assert.equal(added.length,1);cycleIds.push(added[0]);}});
            assert.deepEqual(rows.all(),values,'Populated rows must match');assert.equal(pending(tree),1);
            held=rows.byIdOrFail('R-0');field=held.value;firstSubject=binding(held).subject;
            assert.equal(cycleIds.length,values.length);assert.equal(new Set(cycleIds).size,values.length);assert.deepEqual(cycleIds.map(id=>rows.__findKeyBySubjectId(id)),values.map(row=>row.id));ids.push(...cycleIds);pendingIdentity(cycleIds);before=tree.$();assert.deepEqual(before.rows.all,values);await flush();assert.deepEqual(outbound,[],'No outbound delivery before settlement');
            tx.rollback();captureFacetIdentities(cycleIds);await flush();await connection.settled();freezeReady(cycleIds);assert.deepEqual(rows.all(),[]);assert.equal(pending(tree),0);assert.deepEqual(outbound,[[]]);
            firstNegative=token(source.evidence().member(firstSubject,'ordinary'));
            result.retirementOfferOrder=offers;result.retirementOfferOrderDirection=offers.every((v,i)=>i===0||offers[i-1]<v)?'ascending':offers.every((v,i)=>i===0||offers[i-1]>v)?'descending':'mixed-or-repeated';
            assert.deepEqual([...new Set(offers)].sort((a,b)=>a-b),[...ids].sort((a,b)=>a-b),'Every forgotten lifetime offered exactly through existing retirement path');
          }finally{if(own)Object.defineProperty(source,'requestRetirement',own);else delete source.requestRetirement;}
        }
      });
      after=tree.$();assert.deepEqual(after.rows.all,[]);assert.equal(held(),undefined);assert.equal(field(),undefined);physicalAbsent();const expectedCapture=checkCoverage('aged');await checkpoint('aged');
      let whole;
      const inputVisitsBefore=source.inspect().inputFactVisits;
      sync('whole-native-read-20',()=>{for(let i=0;i<20;i++)whole=tree.$();});assert.deepEqual(whole.rows.all,[]);
      result.phases['whole-native-read-20'].inputFactVisitsDelta=source.inspect().inputFactVisits-inputVisitsBefore;
      result.phases['whole-native-read-20'].observedPath=result.phases['whole-native-read-20'].inputFactVisitsDelta===0?'cached-snapshot-reads':'snapshot-reads-with-native-capture';
      const explicitVisits=source.inspect().inputFactVisits;let captured;
      sync('explicit-whole-source-capture-20',()=>{for(let i=0;i<20;i++)captured=source.captureInput();});
      result.phases['explicit-whole-source-capture-20'].inputFactVisitsDelta=source.inspect().inputFactVisits-explicitVisits;
      assert.equal(result.phases['explicit-whole-source-capture-20'].inputFactVisitsDelta,expectedFacts.size*2*20,'Explicit capture visits all retired physical member+placement views');
      assert.deepEqual(captureSummary(captured),expectedCapture);captured=undefined;
      let negativeReads=0;
      sync('held-negative-read-20',()=>{for(let i=0;i<20;i++){if(held()===undefined)negativeReads++;if(field()===undefined)negativeReads++;}});assert.equal(negativeReads,40);
      for(let i=0;i<5;i++){
        const sent=[];const late=sync(`late-link-${i}-construct`,()=>api.link(rows,{set:value=>sent.push(value)}));
        try{await asyncPhase(`late-link-${i}-drain`,async()=>{await flush();await late.settled();});assert.deepEqual(sent,[]);}finally{sync(`late-link-${i}-dispose`,()=>late.dispose());}
      }
      for(const inputKind of ['before','after','current'])for(const declaration of ['independent','unknown']){
        const target=api.signalTree({value:-1}),sent=[];owned.push(target);const delivery=api.link(target.$.value,{set:value=>sent.push(value)});connections.push(delivery);
        const snapshot=inputKind==='before'?before:after,holder=api.signalTree({input:api.leaf(snapshot)});owned.push(holder);
        let calls=0,receipt,error;
        sync(`declaration-${inputKind}-${declaration}`,()=>{
          try{receipt=delivery.declare({kind:declaration},()=>{
            if(sample.fault==='skip-native-input'&&declaration==='independent'){calls++;target.$.value(snapshot.rows.all.length);}
            else if(inputKind==='current')tree.updateAndReport(value=>{calls++;target.$.value(value.rows.all.length);return{};});
            else holder.$(value=>{calls++;assert.equal(value.input,snapshot);target.$.value(value.input.rows.all.length);return value;});
          });}catch(caught){error=caught;}
        });
        await asyncPhase(`declaration-${inputKind}-${declaration}-drain`,async()=>{await flush();await delivery.settled();});
        const expected=inputKind==='before'?before.rows.all.length:0;assert.equal(calls,1);assert.equal(target.$.value(),expected);assert.deepEqual(sent,[expected]);
        if(declaration==='independent')assert.ok(error?.stage==='after-callback'&&error?.reason==='contradiction','Independent declaration must contradict');
        else{assert.equal(error,undefined);assert.deepEqual(receipt.read(),{state:'started',basis:'surviving'});}
        result.phases[`declaration-${inputKind}-${declaration}`].oracle={calls,value:expected,sent,error:error&&{stage:error.stage,reason:error.reason},receipt:receipt?.read()};
      }
      assert.equal(token(source.evidence().member(firstSubject,'ordinary')),firstNegative);checkCoverage('post-consumers');await checkpoint('post-consumers');
      const fresh=makeRows(sample.small?10:1000,99),sentBefore=outbound.length;
      const freshTx=sync('new-bulk-prepare-install',()=>tree.transact(()=>rows.setAll(fresh)));
      assert.deepEqual(rows.all(),fresh);assert.equal(pending(tree),1);const cycleIds=[...rows.__subjectIds];ids.push(...cycleIds);pendingIdentity(cycleIds);await flush();assert.equal(outbound.length,sentBefore,'No outbound delivery before settlement');
      await asyncPhase('new-bulk-rollback-full-drain',async()=>{freshTx.rollback();await flush();await connection.settled();});
      assert.deepEqual(rows.all(),[]);assert.equal(pending(tree),0);assert(outbound.every(v=>v.length===0));physicalAbsent();captureFacetIdentities(cycleIds);freezeReady(cycleIds);checkCoverage('post-new-bulk');result.freshBulkProofLimit='Fresh facet reference baseline sampled after timed drain; every ready role/cell/flag and actual pending-to-rolled-back destination is checked, but no pre-drain reference equality claim.';await checkpoint('post-new-bulk');
      // Semantic late-recipient checks follow every cost phase so their fresh
      // lifetimes do not alter the measured history. A native updater consumes
      // the complete source before installing a useful literal row.
      result.lateRecipientTraces=[];
      for(const declaration of ['independent','unknown']){
        const sent=[],late=api.link(rows,{set:value=>sent.push(value)});connections.push(late);await flush();assert.deepEqual(sent,[]);
        const value={id:`late-${declaration}`,value:321,f1:1,f2:2,f3:3,f4:4,f5:5,f6:6,f7:7};let calls=0,error,receipt;
        try{receipt=late.declare({kind:declaration},()=>tree.updateAndReport(current=>{calls++;assert.deepEqual(current.rows.all,[]);rows.addOne(value);return{};}));}catch(caught){error=caught;}
        await flush();await late.settled();assert.equal(calls,1);assert.deepEqual(rows.all(),[value]);assert.deepEqual(sent,[[value]]);
        if(declaration==='independent')assert.ok(error?.stage==='after-callback'&&error?.reason==='contradiction','Late native-input independence must contradict');
        else{assert.equal(error,undefined);assert.deepEqual(receipt.read(),{state:'started',basis:'surviving'});}
        result.lateRecipientTraces.push({declaration,calls,sent,error:error&&{stage:error.stage,reason:error.reason},receipt:receipt?.read()});
        late.dispose();rows.setAll([]);await flush();await connection.settled();assert.deepEqual(rows.all(),[]);
      }
      for(const[id,identities]of expectedFacts){const values=facets(id);assert.deepEqual(values.map(token),identities);for(const req of values)assert.deepEqual(proofSummary(req),expectedProofs.get(token(req)));}
      rows.addOne({id:'R-0',value:777,f1:1,f2:2,f3:3,f4:4,f5:5,f6:6,f7:7});rows.changeId('R-0','moved');await flush();await connection.settled();
      assert.equal(rows.byIdOrFail('moved').value(),777);assert.equal(held(),undefined);assert.equal(field(),undefined);assert.equal(token(source.evidence().member(firstSubject,'ordinary')),firstNegative);
      assert.deepEqual(outbound.at(-1),[{id:'R-0',value:777,f1:1,f2:2,f3:3,f4:4,f5:5,f6:6,f7:7}]);assert.deepEqual(after.rows.all,[]);
      result.logicalRetired=ids.length;result.deliveryCount=outbound.length;
      return{tree:new WeakRef(tree),held:new WeakRef(held),field:new WeakRef(field),connection:new WeakRef(connection)};
    }finally{for(const c of connections)c.dispose();connection.dispose();for(const t of owned)t.destroy();tree.destroy();}
  }
  try{
    result.beforeHeapBytes=await gc();const refs=await workload();result.afterHelperHeapBytes=await gc();
    const alive=()=>Object.fromEntries(Object.entries(refs).map(([k,v])=>[k,v.deref()!==undefined]));result.cleanup=[{extraGC:0,...alive()}];
    if(Object.values(alive()).some(Boolean))for(let i=1;i<=20;i++){await new Promise(done=>setImmediate(done));global.gc();if([1,2,5,10,20].includes(i))result.cleanup.push({extraGC:i,...alive()});}
    assert(Object.values(alive()).every(v=>!v),'Stable object after bounded final cleanup');verifyBindings(arm.bindings);result.passed=true;
  }catch(error){result.error=String(error?.stack??error);process.exitCode=1;}
  save(output,result);
}
