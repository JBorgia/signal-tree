from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent;a=Path('/private/tmp/st-c21-gc-routing-successor');c=a/'candidate';sha=lambda b:hashlib.sha256(b).hexdigest()
b=json.loads((a/'BASE-MANIFEST.json').read_text());m=json.loads((a/'SNAPSHOT-CANDIDATE.json').read_text());freeze=json.loads((a/'FREEZE.json').read_text())
assert sha((a/'SNAPSHOT-CANDIDATE.json').read_bytes())==freeze['candidateManifestSha256'];assert sha((a/'gc-routing.patch').read_bytes())==freeze['patchSha256']
assert all(sha((c/f).read_bytes())==h for f,h in m.items())
changed=[f for f in b if b[f]!=m.get(f)];added=list(set(m)-set(b));assert len(changed)==4 and len(added)==1
assert all(m.get(f)==h for f,h in b.items() if f.startswith('packages/') and ('/src/' in f))
e=json.loads((a/'EVIDENCE-SNAPSHOT.json').read_text());assert all(sha((a/f).read_bytes())==h for f,h in e.items())
d=json.loads((a/'DISCOVERY.json').read_text())
for k,run in [('ordinaryBefore','discovery-before'),('ordinaryAfter','discovery-after'),('gcBefore','discovery-gc-before'),('gcAfter','discovery-gc-after')]:
 raw=json.loads((a/'runs'/run/'first.log').read_text());s=sorted(x['file'].split('/packages/kernel/')[1] for x in raw);assert s==sorted(d[k]);assert len(s)==len(set(s))
assert set(d['ordinaryBefore'])-set(d['ordinaryAfter'])=={'src/lib/held-continuation-probe.spec.ts'}
assert set(d['gcAfter'])-set(d['gcBefore'])=={'src/lib/held-continuation-probe.spec.ts'}
assert not(set(d['ordinaryAfter'])-set(d['ordinaryBefore']));assert not(set(d['gcBefore'])-set(d['gcAfter']))
checks=[]
for arm in json.loads((a/'RUN-SUMMARY.json').read_text()):
 result=json.loads(Path(arm['result']).read_text());assert len(result['results'])==12
 rows=[]
 for row in result['results']:
  log=Path(row['log']).read_text();sample=json.loads(Path(row['artifact']).read_text());cmd=json.loads(Path(row['artifact']).with_name(Path(row['artifact']).stem+'-COMMAND.json').read_text())
  assert '1 test' in log;assert len(sample['held'])==len(sample['released'])==12
  assert cmd['env']['NODE_OPTIONS']=='--expose-gc';assert cmd['node']=='v24.15.0'
  assert cmd['argv'][-3:]==['vitest.retention.config.ts', 'src/lib/'+('forwarding-retention-probe.spec.ts' if row['kind']=='forwarding' else 'held-continuation-probe.spec.ts'),'--maxWorkers=1']
  failure=[s for s in log.splitlines() if 'AssertionError:' in s]
  if row['exit']:
   assert row['processExit']==1;assert failure
   if arm['name']=='retained-tree':assert 'AssertionError: tree: expected true to be false' in log
   if arm['name']=='held-positive':assert 'held-continuation-probe.spec.ts:34:123' in log;assert sample['released'][-1]['positive'] is True
  else:assert row['processExit']==0 and not failure
  rows.append({'name':row['name'],'exit':row['exit'],'failure':failure})
 checks.append({'arm':arm['name'],'exit':result['exit'],'children':rows})
for name in ['retained-tree','held-positive']:
 mutation=json.loads((a/'mutants'/name/'MUTATION.json').read_text());f=mutation['file'];old=(c/f).read_text();assert old.count(mutation['find'])==1
 assert old.replace(mutation['find'],mutation['replace'])==(a/'mutants'/name/'candidate'/f).read_text()
 # Other frozen source files in each mutant copy remain identical.
 assert all(sha((a/'mutants'/name/'candidate'/f).read_bytes())==h for f,h in m.items() if f!=mutation['file'])
(p/'VERIFICATION.json').write_text(json.dumps({'candidateManifestSha256':freeze['candidateManifestSha256'],'patchSha256':freeze['patchSha256'],'verifiedCandidateFiles':len(m),'verifiedEvidenceFiles':len(e),'changed':changed,'added':added,'allRuntimeAndOriginalSpecsUnchanged':True,'discoveryCounts':{k:len(d[k]) for k in ['ordinaryBefore','ordinaryAfter','gcBefore','gcAfter']},'rawRuns':checks,'mutantsIsolatedExactly':True},indent=2)+'\n')
print('source/discovery/raw mutants verified')
