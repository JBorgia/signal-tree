import json,sys
from pathlib import Path
root=Path(__file__).resolve().parent
prior=json.loads(Path('/private/tmp/st-c19-large-batch-cleanup-counts/COUNTS.json').read_text())
base=next(r for r in prior if r['n']==128 and r['observed'] and not r['intermediateReads'])
def normalized(row):
 out=[]
 for stage in row['stages']:
  sites={}
  for key,s in stage['sites'].items():
   key=key.split('/packages/kernel/src/')[-1];target=sites.setdefault(key,{'calls':0,'visitsPerN':0});target['calls']+=s['calls'];target['visitsPerN']+=s['visits']/row['n']
  out.append({'stage':stage['stage'],'calls':stage['totalCalls'],'visitsPerN':stage['totalVisits']/row['n'],'sites':sites})
 return out
report=[]
for name in sys.argv[1:]:
 dest=root/'runs'/name;result=json.loads((dest/'RESULT.json').read_text());assert result['exit']==0 and not result['watchdogTriggered'] and result['sourceUnchanged'],result
 rows=json.loads((dest/'tmp/history-filter-counts.json').read_text());assert rows
 for row in rows:assert normalized(row)==normalized(base),(name,row['iteration'],normalized(row))
 pids=sorted({b['pid'] for r in rows for b in r['boundaries']});assert len(pids)==1
 summary={'run':name,'records':len(rows),'n':rows[0]['n'],'pids':pids,'allSitesCallsAndNormalizedVisitsMatchPredecessor':True,'firstBoundary':rows[0]['boundaries'][0],'firstFinalBoundary':rows[0]['boundaries'][-1],'lastBoundary':rows[-1]['boundaries'][-1]}
 report.append(summary)
print(json.dumps(report,indent=2))
