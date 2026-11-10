from pathlib import Path
import hashlib,json,subprocess,sys,datetime
p=Path(sys.argv[1]).resolve();reg=json.loads((p/'PREREGISTRATION.json').read_text());bindings=json.loads((p/'BINDINGS.json').read_text());schedule=json.loads((p/'SCHEDULE.json').read_text());sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert not (p/'STARTED.json').exists(),'Never overwrite or favorably retry a started packet'
assert len(schedule)==82 and len({v['id'] for v in schedule})==82
assert sha(p/'SCHEDULE.json')==reg['scheduleSha256'] and sha(p/'BINDINGS.json')==reg['bindingsSha256']
assert sha(Path(__file__))==reg['runnerSha256']
def verify(scope):
 bad=[]
 for arm,b in bindings[scope].items():
  path=Path(b['manifest']);assert sha(path)==b['manifestSha256'];root=Path(b['root'])
  manifest=json.loads(path.read_text())
  if 'fileSetBase' in b:
   base=root/b['fileSetBase'];actual={str(f.relative_to(root)) for f in base.rglob('*') if f.is_file()};
   if actual!=set(manifest):bad.append(arm+':file-set')
  if scope=='sources':
   actual=set(subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=root).decode().split('\0'))-{''};actual={n for n in actual if (root/n).is_file()}
   if actual!=set(manifest):bad.append(arm+':source-file-set')
  for n,h in manifest.items():
   f=root/n;expected=h['sha256'] if isinstance(h,dict) else h
   if not f.is_file() or sha(f)!=expected or (isinstance(h,dict) and 'executable' in h and f.stat().st_mode&0o111!=h['executable']):bad.append(arm+':'+n)
 return bad
before={'sources':verify('sources'),'inputs':verify('inputs')};(p/'BEFORE.json').write_text(json.dumps(before,indent=2)+'\n');assert not any(before.values()),before
(p/'STARTED.json').write_text(json.dumps({'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'children':len(schedule),'workloadChildren':72,'offlineAnalysisChildren':10,'meaning':'Diagnostic only; no promotion or prior-cohort replacement.'},indent=2)+'\n');results=[]
for row in schedule:
 bad=verify('inputs');assert not bad,bad;print('START',row['ordinal'],row['id'],flush=True)
 argv=['python3',str(p/'guard.py'),row['id'],str(row['timeoutSeconds']),'python3',str(Path(bindings['toolRoot'])/'tools/pending-drain-attribution/run-child.py'),str(p),row['id']]
 subprocess.run(argv,check=True);result=json.loads((p/'runs'/row['id']/'RESULT.json').read_text());child=p/'children'/row['id'];valid=result['exit']==0 and not result['guardReason'] and not result['sourceMismatches'] and not result['remainingOwned']
 output=Path(row['output']);validation=None
 try:
  assert output.is_file(),'Missing output';data=json.loads(output.read_text())
  if row['family']=='scaling':
   assert data['ownersPerTree']==row['ownersPerTree'] and data['variant']==row['variant'] and data['treeCount']==10 and data['rowCount']==1000 and data['totalOwners']==10*row['ownersPerTree']
   assert all(3<=data['memory'][name]['rounds']<=40 for name in ['baseline','primed','pending','settled','destroyed'])
   assert 0<=data['weakTreesAlive']<=10
  elif row['family']=='snapshot':
   f=Path(row['snapshot']);assert f.is_file() and 0<f.stat().st_size<=1073741824;assert data['checkpoint']==row['checkpoint']
  elif row['family']=='allocation':assert data['profile']['head'] and data['mode']==row['mode']
  elif row['family']=='trace':assert data['trace']['counters'].get('Source.prepare',0)>0 and data['mode']==row['mode']
  elif row['family']=='economics':assert data['writes']==2000 and len(data['turns'])==22 and data['twoImmediateDrain']['turn']==2
  elif row['family']=='analysis':assert data['retainedSemantics']['calibrated'] and data['snapshot']['nodes']>0
 except Exception as error:valid=False;validation=repr(error)
 after=verify('inputs');valid=valid and not after;record={'id':row['id'],'valid':valid,'guard':result,'validationError':validation,'inputMismatches':after};results.append(record);(p/'STATUS.json').write_text(json.dumps({'completed':len(results),'planned':len(schedule),'results':results},indent=2)+'\n');print('END',row['id'],'valid' if valid else 'FAILED',flush=True)
 if not valid:break
final={'completed':len(results),'valid':sum(v['valid'] for v in results),'sources':verify('sources'),'inputs':verify('inputs'),'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};(p/'AFTER.json').write_text(json.dumps(final,indent=2)+'\n');assert len(results)==82 and all(v['valid'] for v in results) and not final['sources'] and not final['inputs'],final
