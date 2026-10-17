#!/usr/bin/env python3
import pathlib,json,sys,collections,subprocess,hashlib
p=pathlib.Path(sys.argv[1]); baseline=pathlib.Path(sys.argv[2]); root=pathlib.Path(__file__).resolve().parents[4]
tracked=set(subprocess.check_output(['git','ls-files'],cwd=baseline,text=True).splitlines())
def expected(file,name):
 return (file.endswith('open-key-reachability.spec.ts') or (file.endswith('e-granularity.spec.ts') and 'OPEN-KEY:' in name) or (file.endswith('reversal-known-limitations.spec.ts') and '— desired:' in name) or (file.endswith('provenance-spike.spec.ts') and any('spike '+n+'.' in name for n in ['4','6','10','12'])))
def load(path):
 d=json.loads(path.read_text());out={};counts=collections.Counter()
 for suite in d['testResults']:
  file='packages/'+suite['name'].split('/packages/')[-1];occ=collections.Counter()
  for t in suite.get('assertionResults',[]):
   name=t['fullName'];occ[name]+=1;k=(file,name,occ[name]);e=expected(file,name);status=t['status'];msg='\n'.join(t.get('failureMessages',[]));kind=('expected_failure_satisfied' if status=='passed' else 'expected_failure_now_succeeds' if 'Expect test to fail' in msg else status) if e else status
   row={'file':file,'name':name,'occurrence':occ[name],'status':status,'kind':kind,'message':msg,'baselineTracked':file in tracked}
   out[k]=row;counts[kind]+=1
 return out,dict(counts)
def classification(r):
 msg=r['message'];f=r['file']
 if r['kind']=='expected_failure_now_succeeds':return 'expected-failure assertion now succeeds (gain; unchanged test remains red)'
 if 'b-public-link.spec.ts' in f:return 'global B harness also selects comparator; incumbent-refusal expectation no longer compares incumbent'
 if 'native-ownership-r1-baseline-counterexample' in f:return 'preserved baseline primitive replacement'
 if 'b-public-link-destruction-counterexample' in f:return 'preserved tree-only Link cancellation counterexample'
 if 'Cannot read properties of undefined' in msg and any(s in msg for s in ['getPendingTurn','readConfirmedTurns','getConfirmedTurn','readPendingTurns']):return 'incumbent-runtime-coupled fixture; no corresponding B observation exercised'
 if 'Missing required test capability' in msg:return 'unsupported adapter observation; fault probe not exercised'
 if any(s in msg for s in ['Expected all configured tooling readers','Missing realization descriptor store']):return 'missing observation capability; public/private contract needs case-level interpretation'
 if 'expected [Function] to throw' in msg or "expected function to throw" in msg or "no-refusal" in msg:return 'changed refusal verdict; useful capability vs unsafe success requires state-specific evidence'
 if 'Delta successor unavailable' in msg:return 'placement dependency refusal (minimal public member independently reproduced)'
 if 'Maximum call stack' in msg or 'too many arguments' in msg:return 'large preparation failure; inspect raw stack'
 if 'devtools-jump-0-1' in f:return 'inspection participation; reproduced state failures separate from refusal differences'
 if 'link-absent-locations' in f:return 'hidden-collection publication mismatch (focused replay)'
 if 'inspect-path-ambiguity' in f or 'inspect-address' in f:return 'inspection representation mismatch'
 return 'assertion differs; exact expected/actual preserved, first cause not independently isolated'
arms={};summary={}
for arm in ['baseline','default','b']:
 rows,c=load(p/f'full-{arm}-kernel.json');arms[arm]=rows;summary[arm]=c
 summary[arm+'-tracked-only']=dict(collections.Counter(r['kind'] for r in rows.values() if r['baselineTracked']))
changes=[]
for k in sorted(set(arms['default'])|set(arms['b'])):
 a=arms['default'].get(k);b=arms['b'].get(k)
 if a and b and a['status']==b['status'] and a['kind']==b['kind']:continue
 row={'default':a,'B':b,'interpretation':classification(b) if b else 'not run in B'};changes.append(row)
framework=[]
for project in ['angular','react','vue','solid']:
 rows,c=load(p/f'full-b-{project}.json');summary['B-'+project]=c
 for row in rows.values():
  if row['status']=='failed':framework.append({'B':row,'default':'passed in full default framework log','interpretation':classification(row)})
summary['changed-kernel']=len(changes);summary['classification-counts']=dict(collections.Counter(x['interpretation'] for x in changes));summary['framework-failures']=len(framework)
# Exact baseline tracked assertions changed under default candidate.
basechanges=[]
for k,a in arms['baseline'].items():
 b=arms['default'].get(k)
 if a['baselineTracked'] and b and (a['status']!=b['status'] or a['kind']!=b['kind']):basechanges.append({'baseline':a,'default':b})
summary['baseline-tracked-default-changes']=len(basechanges)
(p/'verdict-summary.json').write_text(json.dumps(summary,indent=2)+'\n');(p/'verdict-ledger.json').write_text(json.dumps({'kernelChanges':changes,'frameworkChanges':framework,'baselineTrackedDefaultChanges':basechanges},indent=2)+'\n')
print(json.dumps(summary,indent=2))
