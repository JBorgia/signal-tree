from pathlib import Path
import json,hashlib
r=Path(__file__).resolve().parent;d=r/'run-small'
def records(p):return [json.loads(x) for x in p.read_text().splitlines()]
e=records(d/'events.jsonl');n=records(d/'nodes.jsonl');b=records(d/'boundary-census.jsonl');c=records(d/'census.jsonl')
workers=[x for x in n if x['kind']=='node-start' and any('/vitest/dist/workers/forks.js' in arg for arg in x['argv'])]
worker_ids={x['pid'] for x in workers}
def parse(row):
 p=row.split(None,7);return {'pid':int(p[0]),'ppid':int(p[1]),'pgid':int(p[2]),'state':p[3],'cpu':float(p[4]),'rssKiB':int(p[5]),'elapsed':p[6],'command':p[7] if len(p)>7 else ''}
module=[x for x in e if x['kind'].startswith('module-')]
starts=[x for x in e if x['kind']=='case-start'];ends=[x for x in e if x['kind']=='case-end'];assert len(starts)==len(ends)==14
observed=records(d/'observed-starts.jsonl');assert len(observed)==14
assert [(x.get('file'),x.get('name')) for x in starts]==[(x['event'].get('file'),x['event'].get('name')) for x in observed]
summary={'resolved':next(x for x in e if x['kind']=='resolved-config'),'effectiveCoordinatorEnv':e[0]['env'],'caseStarts':len(starts),'caseEnds':len(ends),'observedStarts':len(observed),'modules':module,'workers':workers,'boundaryCensuses':[],'maxObservedForkProcesses':0,'periodicCensusSamples':len(c),'allFinalRows':c[-1]['rows']}
for row in b:
 parsed=[parse(x) for x in row['rows']]
 summary['boundaryCensuses'].append({'kind':row['kind'],'at':row['at'],'workers':[x for x in parsed if x['pid'] in worker_ids],'ownedProcessCount':len(parsed)})
for row in b+c:
 summary['maxObservedForkProcesses']=max(summary['maxObservedForkProcesses'],sum(parse(x)['pid'] in worker_ids for x in row['rows']))
summary['sourceVerification']=json.loads((r/'VERIFICATION.json').read_text())
(r/'ANALYSIS.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['caseStarts','caseEnds','observedStarts','maxObservedForkProcesses','periodicCensusSamples','boundaryCensuses','sourceVerification']},indent=2))
