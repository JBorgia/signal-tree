from pathlib import Path
import hashlib,json,shutil
r=Path(__file__).resolve().parent;s=Path('/private/tmp/st-c21-held-gc');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((s/'BASE-MANIFEST.json').read_text());data={'baseHash':h(s/'BASE-MANIFEST.json'),'arms':{},'source':{}}
for p in ['packages/kernel/src/lib/held-continuation-probe.spec.ts','packages/kernel/retention-probe.config.ts','packages/kernel/vitest.config.ts','packages/kernel/vitest.retention.config.ts','tools/held-continuation-probe/project.json','tools/check-forwarding-retention.mjs','tools/verify-gates.mjs','tools/lib/heap-quiescence.mjs','packages/kernel/src/lib/internals/selected-write-operation.ts']:
 src=s/'candidate'/p;assert h(src)==m[p],p;dst=r/'source'/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst);data['source'][p]=h(src)
for arm in ['hold-proceed','drop-proceed','hold-row']:
 src=s/arm;dst=r/arm;dst.mkdir(exist_ok=True)
 for f in ['COMMAND.json','PROCESS.json','RESULT.json','first.log','samples.json']:
  shutil.copyfile(src/f,dst/f)
 sample=json.loads((src/'samples.json').read_text());result=json.loads((src/'RESULT.json').read_text());raw=(src/'first.log').read_text()
 assert sample['mode']==arm and sample['node']=='v24.15.0' and len(sample['held'])==len(sample['released'])==12
 assert sample['held'][-1]['negative']==False and all(x['positive'] for x in sample['held']) and sample['released'][-1]['positive']==False
 if arm=='hold-proceed':assert 'cannot replay' in sample['staleError']
 if arm=='hold-row':assert all(x['row'] for x in sample['held'])
 assert result['exit']==0 and result['sourceUnchanged'] and result['watchdog'] is None and '1 passed (1)' in raw
 data['arms'][arm]={'artifactSha256':h(src/'samples.json'),'allOriginalAssertionsRechecked':True,'heldRounds':12,'releasedRounds':12,'node':sample['node'],'nodeOptions':sample.get('nodeOptions'),'reporterNotInstalledHistoricalHarness':result['reporterNotInstalledHistoricalHarness']}
for f in ['REVIEW.md','ROUTING-PROPOSAL.md','SUMMARY.json','SETUP-FIRST-FAILURE.txt','EVIDENCE-SNAPSHOT.json']:shutil.copyfile(s/f,r/('AUTHOR-'+f))
(r/'AUDIT.json').write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data['arms'],indent=2))
