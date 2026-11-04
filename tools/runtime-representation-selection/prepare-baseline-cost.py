from pathlib import Path
import json,hashlib,shutil,datetime
base=Path('/private/tmp/st-v16-sparse-responsibility-0');p=base/'baseline-cost';p.mkdir(exist_ok=False);old=Path('/private/tmp/st-v16-runtime-attribution/cost');sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
shutil.copytree(old/'harness',p/'harness')
runner=(old/'campaign.py').read_text().replace('len(schedule)==84','len(schedule)==24').replace('maxChildren\':84','maxChildren\':24').replace('/84','/24').replace("(root/'dist/packages').rglob('*')", "(root/b.get('artifactSubdirectory','dist/packages')).rglob('*')").replace("'rollback':200};t=", "'rollback':200,'construction':200};t=")
(p/'campaign.py').write_text(runner);analysis=(old/'analyze.py').read_text().replace('len(local)==12','len(local)==8').replace('from5 per arm','from3 per arm').replace('range(5)','range(3)');(p/'analyze.py').write_text(analysis)
roots={'retained':base/'released-v15','selected':Path('/Users/jonathanborgia/code/signaltree/.worktrees/v16-integration-candidate')};sources={};artifacts={}
for arm,root in roots.items():
 manifest=p/(arm.upper()+'-MANIFEST.json')
 if arm=='retained':
  m=json.loads((base/'V15-ARTIFACTS.json').read_text())['files'];m={'package/'+n:h for n,h in m.items()};manifest.write_text(json.dumps(m,indent=2)+'\n')
 else:shutil.copy2(old/'RETAINED-MANIFEST.json',manifest)
 sources[arm]={'root':str(root),'manifest':str(manifest),'manifestSha256':sha(manifest)}
 sub='package' if arm=='retained' else 'dist/packages';entries={str(f.relative_to(root)):{'sha256':sha(f),'executable':f.stat().st_mode&0o111} for f in sorted((root/sub).rglob('*')) if f.is_file() and 'node_modules' not in f.relative_to(root).parts};amap=p/(arm.upper()+'-ARTIFACTS.json');amap.write_text(json.dumps(entries,indent=2)+'\n');artifacts[arm]={'root':str(root),'artifactSubdirectory':sub,'manifest':str(amap),'manifestSha256':sha(amap),'files':len(entries)}
 assert (root/('package/dist/enhancers/transactions/transactions.js' if arm=='retained' else 'dist/packages/kernel/dist/enhancers/transactions/transactions.js')).is_file()
prior=json.loads((old/'BINDINGS.json').read_text());deps=prior['dependencies']
for f in [Path('/Users/jonathanborgia/code/signaltree/node_modules/tslib/package.json'),Path('/Users/jonathanborgia/code/signaltree/node_modules/tslib/tslib.es6.mjs')]:
 if f.exists():deps['hashes'][str(f)]=sha(f)
bindings={'sources':sources,'artifacts':artifacts,'dependencies':deps,'retained':'Publishednpm@signal-tree/kernel15.4.4;registrySHA512/SHA1verified;109files','selected':'Frozenv163eabc/runtimefe18;193filesealunchanged','publicationIdentity':json.loads((base/'V15-REGISTRY.json').read_text()),'artifactProvenance':{'retained':{'kind':'publishednpmartifact','metadata':str(base/'V15-REGISTRY.json'),'tarball':str(base/'kernel-15.4.4.tgz'),'tarballSha256':sha(base/'kernel-15.4.4.tgz')},'selected':prior['buildReceipts']['retained']},'limits':'Commonordinaryworkloadsonly;notsemanticparity,capabilitycostdecompositionornewprototypecost;sampledresourceguardsnotSLOs'};(p/'BINDINGS.json').write_text(json.dumps(bindings,indent=2)+'\n')
schedule=[];ordinal=0;node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node';profiles=[('construction',0),('point',1000),('heap-populated',1000)]
for profile,size in profiles:
 order=[('retained','aa0'),('retained','aa1')]
 for i in range(3):order += [(a,'sample'+str(i)) for a in (['retained','selected'] if i%2==0 else ['selected','retained'])]
 for arm,label in order:
  ordinal+=1;h='child-heap-v2.mjs' if profile.startswith('heap') else 'child.mjs';entry=roots[arm]/('package/dist' if arm=='retained' else 'dist/packages/kernel/dist');schedule.append({'id':f'{profile}-{size}-{arm}-{label}','ordinal':ordinal,'profile':profile,'size':size,'arm':arm,'label':label,'argv':[node,'--expose-gc',str(p/'harness'/h),str(entry),profile,str(size)],'cwd':str(p/'harness')})
(p/'SCHEDULE.json').write_text(json.dumps(schedule,indent=2)+'\n');reg=json.loads((old/'PREREGISTRATION.json').read_text());reg.update({'registeredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Fresh released-v15 vs frozen-v16 commonordinarybaseline;threeprofilesonly;no prototypeorcapability-equivalenceclaim','profiles':[{'kind':k,'size':n} for k,n in profiles],'maxFreshCostChildren':24,'perProfile':'two released-v15 A/A then three alternating AB/BA pairs;8children/profile','bindingsSha256':sha(p/'BINDINGS.json'),'scheduleSha256':sha(p/'SCHEDULE.json'),'runnerSha256':sha(p/'campaign.py'),'harnessHashes':{n:sha(p/'harness'/n) for n in ['child.mjs','child-heap-v2.mjs','heap-quiescence.mjs']},'review':{'scope':'ordinarysharedoutcomes;originalharnessunchanged;notnewruntimepromotion'},'exclusiveSlot':'Main owns sole heavy slot;no calibrated exclusive-core or host-contention claim'})
reg['analysisRules']['samples']='Allrawsamples;3comparison samples/arm with2separateA/A controls;descriptive ranges only,not confidence intervals';reg['analysisRules']['decision']='Quantifycommonordinarybaselinegaponly;cannotseparateunavoidablesemanticcostfromimplementationcost;no thresholdwaiverorarchitectureselection';reg['failurePolicy']['noRetries']=True
(p/'PREREGISTRATION.json').write_text(json.dumps(reg,indent=2)+'\n');print(str(p),len(schedule),'children')
