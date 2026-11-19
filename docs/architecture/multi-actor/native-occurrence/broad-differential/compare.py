from pathlib import Path
import json,collections,hashlib,re
r=Path('/private/tmp/st-native-broad-differential'); diff=json.loads((r/'FIXTURE-DIFF.json').read_text()); changed=set(diff['changed']);added=set(diff['added']);removed=set(diff['removed']);allrows={};summary={};errors={}
for label in ['predecessor','successor']:
 rows=[];summary[label]={};errors[label]={}
 for project in ['kernel','angular','react','vue','solid']:
  p=r/label/project/'vitest.json';result=json.loads((p.parent/'RESULT.json').read_text())
  if not p.exists():summary[label][project]={'execution':result,'testReport':'absent; inspect first.log, do not infer zero tests passed'};continue
  j=json.loads(p.read_text());summary[label][project]={k:j.get(k) for k in ['success','numTotalTests','numPassedTests','numFailedTests','numPendingTests','numTodoTests','numTotalTestSuites','numFailedTestSuites']};summary[label][project]['execution']=result
  es=[]
  for suite in j.get('testResults',[]):
   name=suite['name'];prefix=str(r/label/'candidate')+'/';name=name[len(prefix):] if name.startswith(prefix) else name
   assertions=suite.get('assertionResults',[])
   if suite.get('message') or (suite.get('status')=='failed' and not assertions):es.append({'file':name,'status':suite.get('status'),'message':suite.get('message'),'assertionCount':len(assertions)})
   occurrences=collections.Counter()
   for t in assertions:
    full=t.get('fullName') or ' '.join([*t.get('ancestorTitles',[]),t.get('title','')]);occurrences[full]+=1
    rows.append({'project':project,'file':name,'fullName':full,'duplicateOrdinal':occurrences[full],'status':t['status'],'failureMessages':t.get('failureMessages',[]),'fixtureClass':'added' if name in added else 'removed' if name in removed else 'changed' if name in changed else 'unchanged'})
  errors[label][project]=es
  summary[label][project]['rawAssertionStatuses']=dict(collections.Counter(t['status'] for suite in j.get('testResults',[]) for t in suite.get('assertionResults',[])))
 allrows[label]=rows
 (r/(label+'-TEST-IDENTITIES.json')).write_text(json.dumps(rows,indent=2))
key=lambda v:(v['project'],v['file'],v['fullName'],v['duplicateOrdinal'])
a={key(v):v for v in allrows['predecessor']};b={key(v):v for v in allrows['successor']};deltas=[]
for k in sorted(a.keys()|b.keys()):
 x=a.get(k);y=b.get(k)
 if not x or not y or x['status']!=y['status']:deltas.append({'identity':k,'before':x,'after':y})
(r/'VERDICT-DELTA.json').write_text(json.dumps(deltas,indent=2));(r/'SUMMARY.json').write_text(json.dumps(summary,indent=2));(r/'SUITE-ERRORS.json').write_text(json.dumps(errors,indent=2))
(r/'FAILURES-AND-SKIPS.json').write_text(json.dumps({label:[x for x in rows if x['status']!='passed'] for label,rows in allrows.items()},indent=2))
# Preserve source-declared skip/expected-failure annotations separately from actual runner verdicts.
annotations={}
for label in ['predecessor','successor']:
 records=[]
 for n in json.loads((r/'FIXTURE-INVENTORY.json').read_text())[label]:
  p=r/label/'candidate'/n
  if p.suffix not in ['.ts','.tsx','.js','.mjs']:continue
  for line,text in enumerate(p.read_text().splitlines(),1):
   if re.search(r'\.(skip|todo|fails|skipIf|runIf)\b',text):records.append({'file':n,'line':line,'source':text.strip()})
 annotations[label]=records
(r/'DECLARED-SKIPS-EXPECTED-FAILURES.json').write_text(json.dumps(annotations,indent=2));print(json.dumps(summary,indent=2));print('delta count',len(deltas))
