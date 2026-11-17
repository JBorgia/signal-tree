#!/usr/bin/env python3
"""Verify and describe complete projection heap cohorts; no timing inference."""
import hashlib,json,pathlib,statistics,sys
root,out=(pathlib.Path(p).resolve() for p in sys.argv[1:]);assert not out.exists()
read=lambda p:json.loads(p.read_text());sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
r=read(root/'results.json');s=read(root/'schedule.json');assert r['passed'] is True and r['scheduleSha256']==sha(root/'schedule.json')
expected=[];profile=0
for width in [8,32]:
 for activation in ['bare','native-loaded']:
  for round in range(3):
   for arm in (['candidate','baseline'] if (round+profile)%2 else ['baseline','candidate']):expected.append(dict(arm=arm,rows=10000,width=width,activation=activation,round=round))
   if round!=1:
    for repeat in [0,1]:expected.append(dict(arm='baseline',rows=10000,width=width,activation=activation,round=round,repeat=repeat,control='AA'))
  profile+=1
assert s['samples']==expected and len(r['results'])==40
stages=['empty','populatedUndemanded','firstAll','idsAndAll','editedHeldSnapshot','snapshotReleased','structuralChurn','destroyed'];assert s['stages']==stages
bindings={str(root/'results.json'):sha(root/'results.json'),str(root/'schedule.json'):sha(root/'schedule.json')};packets={}
def verify(p,h):
 p=pathlib.Path(p);key=str(p)
 if key in bindings:assert bindings[key]==h
 else:assert sha(p)==h,(p,'drift');bindings[key]=h
for p,h in s['bindings'].items():verify(p,h)
for arm,p in s['packets'].items():
 path=pathlib.Path(p)/'packet.json';assert str(path) in s['bindings'];packets[arm]=read(path)
 for file,h in packets[arm]['bindings'].items():assert s['bindings'].get(file)==h;verify(file,h)
children=[]
for index,(sample,inv) in enumerate(zip(expected,r['results'],strict=True)):
 assert inv['index']==index and inv['sample']==sample and inv['passed'] and inv['exitCode']==0
 assert not inv.get('signal') and not inv.get('childError') and not inv.get('admissionError')
 path=root/f'invocation-{index}.json';assert read(path)==inv;verify(path,sha(path))
 verify(inv['log'],inv['logSha256']);verify(inv['resultPath'],inv['resultSha256']);child=read(pathlib.Path(inv['resultPath']))
 assert child['passed'] and child['sample']==sample and child['node']==s['node'] and type(child['pid']) is int and child['pid']>0
 assert 'error' not in child and 'cleanupError' not in child
 packet=pathlib.Path(s['packets'][sample['arm']])/'packet.json';assert child['packetPath']==str(packet);verify(packet,child['packetSha256'])
 bundle=packets[sample['arm']]['bundles'][sample['activation']];assert child['bundleSha256']==bundle['sha256'];verify(bundle['path'],bundle['sha256'])
 assert list(child['heap'])==stages
 for checkpoint in child['heap'].values():
  assert set(checkpoint)=={'heapUsed','heapTotal','external','rss'}
  assert all(type(v) is int and v>0 for v in checkpoint.values())
 children.append(child)
profiles=[]
for width in [8,32]:
 for activation in ['bare','native-loaded']:
  group=[c for c in children if c['sample']['width']==width and c['sample']['activation']==activation];metrics={}
  expressions={stage:(stage,None) for stage in stages}
  expressions.update({'populationAboveEmpty':('populatedUndemanded','empty'),'allAboveUndemanded':('firstAll','populatedUndemanded'),'idsAboveAll':('idsAndAll','firstAll'),'churnAboveEmpty':('structuralChurn','empty'),'destroyedAboveEmpty':('destroyed','empty')})
  for name,(a,b) in expressions.items():
   value=lambda c:c['heap'][a]['heapUsed']-(c['heap'][b]['heapUsed'] if b else 0)
   arms={arm:[value(c) for c in sorted(group,key=lambda c:c['sample']['round']) if c['sample']['arm']==arm and 'control' not in c['sample']] for arm in ['baseline','candidate']}
   assert all(len(v)==3 for v in arms.values());delta=[y-x for x,y in zip(arms['baseline'],arms['candidate'],strict=True)]
   aa=[]
   for round in [0,2]:
    pair=sorted([c for c in group if c['sample'].get('control')=='AA' and c['sample']['round']==round],key=lambda c:c['sample']['repeat']);assert len(pair)==2;aa.append(value(pair[1])-value(pair[0]))
   metrics[name]={**arms,'baselineMedian':statistics.median(arms['baseline']),'candidateMedian':statistics.median(arms['candidate']),'pairedDifferences':delta,'pairedMedian':statistics.median(delta),'candidateLowerPairs':sum(d<0 for d in delta),'aaDifferences':aa,'aaMaximumAbsolute':max(map(abs,aa))}
  profiles.append(dict(width=width,activation=activation,rows=10000,metrics=metrics))
bindings[str(pathlib.Path(__file__).resolve())]=sha(pathlib.Path(__file__).resolve())
out.write_text(json.dumps(dict(kind='projection-heap-analysis-v1',children=40,bindings=bindings,profiles=profiles,limits='Bytes of whole-process heap after four requested GC passes separated by event-loop jobs. Paired candidate-minus-baseline; three pairs and two A/A controls per profile. External expected-value fixtures and held caller snapshots are included. No dominator, allocation-byte, universal bound or timing inference.'),indent=2)+'\n')
for profile in profiles:
 print(json.dumps(dict(width=profile['width'],activation=profile['activation'],pairedBytes={name:{key:profile['metrics'][name][key] for key in ['pairedMedian','aaMaximumAbsolute']} for name in ['allAboveUndemanded','idsAboveAll','churnAboveEmpty','destroyedAboveEmpty']})))
