from pathlib import Path
import json,hashlib
p=Path(__file__).parent
read=lambda run,name:json.loads((p/'runs'/run/'observations'/name).read_text())
def event(d,n):return next(e for e in d['events'] if e['name']==n)
def clean(x):
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if k!='stack'}
 if isinstance(x,list):return [clean(v) for v in x]
 return x
runs=['final-kernel','final-angular','source-types-final','spec-types-final','reentry-kernel-final','reentry-angular-final','callbacks-kernel-final','callbacks-angular-final','grouped-kernel-final','grouped-angular-final']
for run in runs:
 r=json.loads((p/'runs'/run/'RESULT.json').read_text());assert r['exit']==0 and r['sourceUnchangedDuringRun'],run
# Native prepublication source/mirror discrimination, measured by real callbacks.
a=read('final-angular','terminal-window.json');assert a['delivered']==1 and a['during']=={'n':2} and a['mirror']==1 and a['cached']=={'n':1} and a['runs']==1
assert read('final-angular','direct-capture.json')==[{'parent':{'n':2},'mirror':1},{'parent':{'n':3},'mirror':2}]
comparisons=[]
for facade in ['kernel','angular']:
 for fail in ['false','true']:
  a=read('callbacks-oracle-'+facade,'sorted-'+fail+'.json');b=read('callbacks-'+facade+'-final','sorted-'+fail+'.json');assert a==b
  comparisons.append({'case':'ungrouped-'+facade+'-'+fail,'exactTraceMatch':True,'comparisons':b['comparisons']})
  a=read('grouped-oracle-'+facade,'sorted-'+fail+'.json');b=read('grouped-'+facade+'-final','sorted-'+fail+'.json')
  assert event(a,'completion-derived')==event(b,'completion-derived') or (event(a,'completion-derived')['value']==event(b,'completion-derived')['value'])
  assert a['derivedRuns']==b['derivedRuns']
  if fail=='false':
   assert a['comparisons']==b['comparisons'];assert len(event(a,'completion-root')['value']['rows']['all'])==2;assert len(event(b,'completion-root')['value']['rows']['all'])==3
  else:
   assert b['comparisons']==a['comparisons']+1;assert event(b,'completion-root')['sameSentinel'];assert event(b,'completion-root')['end']-event(b,'completion-root')['start']==1
  comparisons.append({'case':'grouped-'+facade+'-'+fail,'baselineComparisons':a['comparisons'],'candidateComparisons':b['comparisons'],'difference':'fresh explicit parent read; same error object if comparer throws'})
# Every first/current-call reentry outcome and callback count must match baseline.
for facade in ['kernel','angular']:
 for f in (p/'runs'/('reentry-oracle-'+facade)/'observations').glob('*.json'):
  a=clean(json.loads(f.read_text()));b=clean(read('reentry-'+facade+'-final',f.name));assert event(a,'first-root')==event(b,'first-root'),(facade,f.name)
  if f.stem.startswith('marker-'):assert a['calls']==b['calls']
  comparisons.append({'case':'reentry-'+facade+'-'+f.stem,'firstCallExactMatch':True,'baselineCalls':a['calls'],'candidateCalls':b['calls'],'laterValuesMayDiffer':a!=b})
for f in (p/'runs/warm-oracle-angular/observations').glob('*.json'):
 a=clean(json.loads(f.read_text()));b=clean(read('reentry-angular-final',f.name));assert a==b
 comparisons.append({'case':f.stem,'exactTraceMatch':True})
m=json.loads((p/'BASE-SOURCE.json').read_text())
assert all(hashlib.sha256((p/'oracle'/n).read_bytes()).hexdigest()==h for n,h in m.items())
assert (p/'tests.patch').read_bytes()==Path('/private/tmp/st-parent-snapshot-c8-controls/tests.patch').read_bytes()
result={'finalRuns':runs,'assertions':'passed','comparisons':comparisons,'oracleBaselineFilesUnchanged':len(m),'originalParentPatchUnchanged':True,'limits':'No release, universal callback or retention claim. Grouped error-path and next-explicit-read deltas are exposed for independent review.'}
(p/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n');print('Proof assertions passed; '+str(len(comparisons))+' trace comparisons recorded.')
