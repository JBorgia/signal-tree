from pathlib import Path
import json,collections,hashlib
r=Path(__file__).resolve().parent;base=Path('/private/tmp/st-r3-compatibility-inventory');c=base/'candidate';d=r/'full-runs/kernel';events=[]
for line in (d/'events.jsonl').read_text().splitlines():
 try:events.append(json.loads(line))
 except ValueError:pass
rel=lambda p:p.removeprefix(str(c)+'/')
selected=set((r/'SELECTED-FILES.txt').read_text().splitlines());mods={rel(e['file']):e for e in events if e['kind']=='module-end'};started={rel(e['file']) for e in events if e['kind']=='module-start'}
assert not started-selected,'unexpected files executed'
cases=[x for e in mods.values() for x in e['cases']]+[e for e in events if e['kind']=='case-result' and rel(e['file']) not in mods]
counts=collections.Counter()
for x in cases:
 key='expectedFailureSatisfied' if x.get('expectedFailure') and x['state']=='passed' else 'expectedFailureMarkedButFailed' if x.get('expectedFailure') and x['state']=='failed' else 'todo' if x['state']=='skipped' and x.get('mode')=='todo' else x['state'];counts[key]+=1
fail=[x for x in cases if x['state']=='failed']
manifest=json.loads((base/'BASE-MANIFEST.json').read_text())
for x in fail:
 x['testPath']=rel(x['file']);x['testSha256']=manifest[x['testPath']];x['classification']='new observed first failure; runtime/fixture/oracle cause not adjudicated';x['rawLog']=str(d/'first.log')
(r/'CASE-LEDGER.json').write_text(json.dumps(cases,indent=2)+'\n');(r/'NEW-FAILURES.json').write_text(json.dumps(fail,indent=2)+'\n')
prior=set((base/'full-runs/kernel/COMPLETED-FILES.txt').read_text().splitlines());priorStarted=set(prior)|set((base/'full-runs/kernel/STARTED-INCOMPLETE-FILES.txt').read_text().splitlines());assert not started&priorStarted
allpaths={rel(e['file']) for e in json.loads((base/'discovery/kernel/stdout.json').read_text())};completed=prior|set(mods);allstarted=priorStarted|started
for name,paths in [('NEW-COMPLETED',set(mods)),('CONTINUATION-UNSTARTED',selected-started),('UNION-COMPLETED',completed),('UNION-UNSTARTED',allpaths-allstarted),('UNION-INCOMPLETE',allstarted-completed)]:
 (r/(name+'.txt')).write_text('\n'.join(sorted(paths))+'\n')
old=json.loads((base/'full-runs/kernel/SUMMARY.json').read_text())['counts'];aggregate=collections.Counter(old);aggregate.update(counts)
s={'selection':len(selected),'started':len(started),'completed':len(mods),'counts':dict(counts),'result':json.loads((d/'RESULT.json').read_text()) if (d/'RESULT.json').exists() else None,'runEndSeen':any(e['kind']=='run-end' for e in events),'unexpectedFiles':sorted(started-selected),'priorOverlap':sorted(started&priorStarted),'unionCompleted':len(completed),'unionUnstarted':len(allpaths-allstarted),'unionIncomplete':sorted(allstarted-completed),'unionObservedCounts':dict(aggregate),'largeGateRemainsBlocked':True}
(r/'SUMMARY.json').write_text(json.dumps(s,indent=2)+'\n');print(json.dumps(s,indent=2))
