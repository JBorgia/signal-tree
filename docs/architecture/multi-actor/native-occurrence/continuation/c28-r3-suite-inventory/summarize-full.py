from pathlib import Path
import json,collections,hashlib
r=Path(__file__).resolve().parent;c=r/'candidate';summaries=[]
for d in sorted((r/'full-runs').iterdir()):
 p=d/'events.jsonl';events=[]
 if p.exists():
  for line in p.read_text().splitlines():
   try:events.append(json.loads(line))
   except ValueError:pass
 modules={e['file']:e for e in events if e['kind']=='module-end'}
 cases=[x for e in modules.values() for x in e['cases']]
 cases += [e for e in events if e['kind']=='case-result' and e['file'] not in modules]
 counts=collections.Counter()
 for x in cases:
  state=x['state'];expected=x.get('expectedFailure',False)
  key='expectedFailureSatisfied' if expected and state=='passed' else 'expectedFailureMarkedButFailed' if expected and state=='failed' else 'todo' if state=='skipped' and x.get('mode')=='todo' else state
  counts[key]+=1
 fail=[x for x in cases if x['state']=='failed']
 for x in fail:
  if x['file'].endswith('branch-declaration-qualification.spec.tsx') and ('actual-owner' in x['name'] or 'disposed held' in x['name']):label='preregistered historical receipt-oracle conflict; inspect actual error'
  elif x['file'].endswith('equal-owner-public-adversaries.spec.ts') and 'ancestor' in x['name'] and 'dependent' in x['name'] and 'independent' not in x['name']:label='preregistered historical ancestor-recipient oracle conflict; inspect actual error'
  else:label='unclassified first failure; no runtime/fixture causality inferred'
  x['classification']=label
 expected={e['file'] for e in json.loads((r/'discovery'/d.name/'stdout.json').read_text())}
 summary={'project':d.name,'counts':dict(counts),'discoveredFiles':len(expected),'startedFiles':len({e['file'] for e in events if e['kind']=='module-start'}),'completedFiles':len(modules),'missingCompletion':sorted(expected-set(modules)),'unexpectedModules':sorted(set(modules)-expected),'runEndSeen':any(e['kind']=='run-end' for e in events),'result':json.loads((d/'RESULT.json').read_text()) if (d/'RESULT.json').exists() else None,'failures':fail}
 (d/'CASE-LEDGER.json').write_text(json.dumps(cases,indent=2)+'\n');(d/'FAILURES.json').write_text(json.dumps(fail,indent=2)+'\n');(d/'SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n');summaries.append(summary)
(r/'FULL-SUMMARY.json').write_text(json.dumps(summaries,indent=2)+'\n')
for s in summaries:print(s['project'],s['counts'],'files',s['completedFiles'],'/',s['discoveredFiles'],'runEnd',s['runEndSeen'])
