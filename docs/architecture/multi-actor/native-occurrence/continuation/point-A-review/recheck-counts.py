from pathlib import Path
import json,collections,re
p=Path(__file__).resolve().parent;totals={}
def hist(row,exclude_private=False):
 h=collections.Counter()
 for e in row['events']:
  stack=e['stack'];first=stack.splitlines()[0] if stack else ''
  if exclude_private and '/experimental-publication/private.ts:' in first:continue
  stack=re.sub(r'/private/tmp/st-c21-point-bounded-alternatives/(baseline|A)/','<COPY>/',stack)
  stack=re.sub(r'(experimental-publication/private.ts):\d+:\d+',r'\1:SOURCE',stack)
  stack=stack.replace('at Module.captureNativeInput (','at captureNativeInput (')
  h[(e['operation'],stack,'calls')]+=e['calls'];h[(e['operation'],stack,'visits')]+=e['visits']
 return h
for label,expected in [('baseline',13800),('A',13000)]:
 rows=[json.loads((p/'author-evidence'/f'{label}-point'/'observations'/f'rows-{n}.json').read_text()) for n in [2000,20000]]
 assert rows[0]['events']==rows[1]['events'];assert rows[0]['perWrite']==rows[1]['perWrite']==[expected//200]*200
 for r in rows:assert r['total']==r['original']==expected==sum(e['visits'] for e in r['events'])
 totals[label]=rows[0]
assert hist(totals['baseline'],True)==hist(totals['A'],True)
report={'baseline':{'totalEachPopulation':13800,'visitsEveryUpdate':69},'A':{'totalEachPopulation':13000,'visitsEveryUpdate':65},'delta':800,'sameHistogramsAcrossSizes':True,'nonPrivateHistogramsEqualAfterDocumentedNormalization':True,'normalizations':['baseline/A checkout prefix','private.ts shifted line/column','captureNativeInput vs Module.captureNativeInput (same source site,200 empty filter calls)'],'expectedUnchangedBudgetFailure':True}
for label,row in totals.items():
 ops=collections.Counter()
 for e in row['events']:
  if '/experimental-publication/private.ts:' in (e['stack'].splitlines()[0] if e['stack'] else ''):ops[e['operation']]+=e['visits']
 report[label]['privateOperationVisits']=dict(ops)
(p/'COUNT-COMPARISON.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
