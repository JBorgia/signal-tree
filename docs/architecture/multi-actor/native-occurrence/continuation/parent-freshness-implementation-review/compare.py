from pathlib import Path
import json
p=Path(__file__).parent/'runs';result=[]
def clean(x):
 if isinstance(x,dict):return {k:clean(v) for k,v in x.items() if k!='stack'}
 if isinstance(x,list):return [clean(v) for v in x]
 return x
def read(side,name):return clean(json.loads((p/side/'observations'/name).read_text()))
def event(d,name):return next(x for x in d['events'] if x['name']==name)
for facade in ['kernel','angular']:
 for seam in ['marker','sort']:
  for case in ['E1','E3','E4','E5-child','E5-self']:
   name=seam+'-'+case+'.json';a=read('oracle-'+facade,name);b=read('focused-'+facade,name)
   assert event(a,'first-root')==event(b,'first-root'),(facade,name)
   result.append({'facade':facade,'case':name,'firstCallExactWithoutStack':True,'baseCalls':a['calls'],'candidateCalls':b['calls']})
 for fail in ['false','true']:
  a=read('oracle-'+facade,'sorted-'+fail+'.json');b=read('focused-'+facade,'sorted-'+fail+'.json')
  assert a['derivedRuns']==b['derivedRuns']==3
  assert event(a,'completion-derived')['value']==event(b,'completion-derived')['value']
  assert a['calls']==b['calls']==1
  if fail=='true':
   assert a['comparisons']==9 and b['comparisons']==10
   assert event(b,'completion-root')['sameSentinel'] is True
   assert event(b,'completion-root')['end']-event(b,'completion-root')['start']==1
  else: assert len(event(b,'completion-root')['value']['rows']['all'])==3 and len(event(a,'completion-root')['value']['rows']['all'])==2
  result.append({'facade':facade,'case':'grouped-'+fail,'baseComparisons':a['comparisons'],'candidateComparisons':b['comparisons'],'derivedRuns':b['derivedRuns']})
(Path(__file__).parent/'PAIRED-COMPARISONS.json').write_text(json.dumps(result,indent=2));print('24 paired controls passed')
