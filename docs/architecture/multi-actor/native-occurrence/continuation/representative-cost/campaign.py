# Finite schedule from historical representative-cost runner; owned-process
# supervision reused from the reviewed integration resource controllers.
from pathlib import Path
import os,sys,json,hashlib,subprocess,time,signal,re,math,datetime
p=Path(__file__).resolve().parent;sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();reg=json.loads((p/'PREREGISTRATION.json').read_text());bindings=json.loads((p/'BINDINGS.json').read_text());schedule=json.loads((p/'SCHEDULE.json').read_text())
assert len(schedule)==84 and sha(p/'campaign.py')==reg['runnerSha256'] and sha(p/'SCHEDULE.json')==reg['scheduleSha256'] and sha(p/'BINDINGS.json')==reg['bindingsSha256']
if (p/'STARTED.json').exists():raise SystemExit('Already started; no overwrite or favorable retry')
def save(f,v):f.write_text(json.dumps(v,indent=2)+'\n')
def sources():
 bad=[]
 for arm,b in bindings['sources'].items():
  if sha(Path(b['manifest']))!=b['manifestSha256']:bad.append(arm+':manifest')
  for n,h in json.loads(Path(b['manifest']).read_text()).items():
   f=Path(b['root'])/n
   if not f.is_file() or sha(f)!=h:bad.append(arm+':'+n)
 return bad

def inputs():
 bad=[]
 for arm,b in bindings['artifacts'].items():
  if sha(Path(b['manifest']))!=b['manifestSha256']:bad.append(arm+':artifact-map')
  m=json.loads(Path(b['manifest']).read_text());root=Path(b['root']);actual={str(f.relative_to(root)) for f in (root/'dist/packages').rglob('*') if f.is_file()}
  if actual!=set(m):bad.append(arm+':artifact-file-set')
  for n,h in m.items():
   f=root/n
   if not f.is_file() or f.is_symlink() or sha(f)!=h['sha256'] or f.stat().st_mode&0o111!=h['executable']:bad.append(arm+':'+n)
 for n,h in reg['harnessHashes'].items():
  if sha(p/'harness'/n)!=h:bad.append('harness:'+n)
 for n,h in bindings['dependencies']['hashes'].items():
  if sha(Path(n))!=h:bad.append('dependency:'+n)
 return bad

def census():
 out={}
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,rss=,lstart=,command='],text=True,timeout=5).splitlines():
  a=line.split(None,8)
  if len(a)==9:out[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'rssBytes':int(a[2])*1024,'birth':' '.join(a[3:8]),'command':a[8]}
 return out

def host():
 raw=subprocess.check_output(['/usr/bin/memory_pressure','-Q'],text=True,timeout=5);m=re.search(r'System-wide memory free percentage:\s*(\d+(?:\.\d+)?)%',raw)
 if not m:raise RuntimeError('host telemetry unavailable')
 return {'raw':raw,'freePercentage':float(m[1])}

def guard(rss,free):
 if rss>4294967296:return 'aggregate-owned-rss-over4GiB'
 if free<25:return 'host-free-percentage-below25'
 return None

def numeric(x):return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def validate(o,s,pid):
 assert o['pid']==pid and o['node']=='v24.15.0' and o['kind']==s['profile'] and o['n']==s['size'],'wrong child identity/profile/size'
 if s['profile'].startswith('heap'):
  m=o['memory'];assert m['count']==10 and isinstance(m['weakAlive'],int) and 0<=m['weakAlive']<=10
  for k in ['baseline','live','settled','destroyed']+(['enhancedIdlePrimed'] if s['profile']=='heap-pending' else []):
   assert numeric(m[k]['heapUsed']) and m[k]['heapUsed']>0 and isinstance(m[k]['rounds'],int) and 3<=m[k]['rounds']<=40
  assert all(numeric(m[k]) and m[k]>0 for k in ['liveBeforeDrain','settledBeforeDrain'])
  if s['profile']=='heap-populated':assert m['enhancedIdlePrimed'] is None
 else:
  counts={'bare':20000,'point':2000,'projection':200,'confirm':200,'rollback':200};t=o['timing'];assert t['count']==counts[s['profile']] and t['warmup']==counts[s['profile']]/10
  assert all(numeric(t[k]) and t[k]>=0 for k in ['syncMs','drainMs'])
  assert all(numeric(t[k][v]) and t[k][v]>=0 for k in ['syncCpu','totalCpu'] for v in ['user','system'])

env=os.environ.copy()
for k in list(env):
 if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','NG_VERSION','NX_WORKSPACE_ROOT_PATH','SEMANTICS_REPORT']:env.pop(k)
env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH']
assert int(subprocess.check_output(['/usr/sbin/sysctl','-n','hw.memsize'],text=True,timeout=5))==34359738368
before={'sourceMismatches':sources(),'inputMismatches':inputs(),'host':host()};save(p/'BEFORE.json',before);assert not before['sourceMismatches'] and not before['inputMismatches'];assert guard(0,before['host']['freePercentage']) is None
save(p/'STARTED.json',{'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'supervisorPid':os.getpid(),'maxChildren':84,'argv':sys.argv,'sanitizedEnvKeys':['ST_*','NODE_OPTIONS','NODE_PATH','NG_VERSION','NX_WORKSPACE_ROOT_PATH','SEMANTICS_REPORT'],'PATH':env['PATH']})
results=[];failedProfiles=set();globalStop=None;seenPids=set()
for s in schedule:
 if s['profile'] in failedProfiles:continue
 d=p/'children'/s['id'];d.mkdir(parents=True,exist_ok=False);save(d/'COMMAND.json',s);owned={};child=None;reason=None;output=None;observations=[];start=time.monotonic();selectedError=None
 print('START',s['ordinal'],'/84',s['id'],flush=True)
 try:
  bad=inputs();assert not bad,('input drift',bad)
  hs=host();save(d/'HOST-BEFORE.json',hs);reason=guard(0,hs['freePercentage'])
  if reason:raise RuntimeError(reason)
  census()
  with (d/'stdout.json').open('x') as out,(d/'stderr.log').open('x') as err:
   child=subprocess.Popen(s['argv'],cwd=p/'harness',env=env,stdout=out,stderr=err,start_new_session=True);start=time.monotonic();save(d/'PROCESS.json',{'pid':child.pid,'pgid':child.pid,'supervisorPid':os.getpid(),'launchMonotonic':start,'launchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()});assert child.pid not in seenPids;seenPids.add(child.pid)
   while child.poll() is None:
    now=time.monotonic();psStart=now;ps=census();psLatency=time.monotonic()-psStart;ids={child.pid}|{pid for pid,v in owned.items() if pid in ps and ps[pid]['birth']==v['birth']}
    while True:
     add={pid for pid,v in ps.items() if v['ppid'] in ids}-ids
     if not add:break
     ids.update(add)
    for pid in ids:
     if pid in ps and pid not in owned:owned[pid]=ps[pid]
    live=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']];save(d/'OWNED.json',list(owned.values()));hstart=time.monotonic();hs=host();hlat=time.monotonic()-hstart;rss=sum(v['rssBytes'] for v in live)
    sample={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':now-start,'aggregateOwnedRssBytes':rss,'memoryPressureFreePercentage':hs['freePercentage'],'perPid':live,'censusLatencySeconds':psLatency,'hostTelemetryLatencySeconds':hlat,'pollStartedMonotonic':now,'pollCompletedMonotonic':time.monotonic()};observations.append(sample)
    with (d/'telemetry.jsonl').open('a') as f:f.write(json.dumps(sample)+'\n')
    reason=guard(rss,hs['freePercentage'])
    if not reason and time.monotonic()-start>=180:reason='child180s-timeout'
    if reason:break
    time.sleep(0.5)
 except Exception as error:
  if not reason:reason='setup-telemetry-or-integrity-error: '+repr(error)
 finally:
  if reason and child is not None and child.poll() is None:
   save(d/'WATCHDOG.json',{'reason':reason,'elapsedSeconds':time.monotonic()-start})
   for sig in [signal.SIGTERM,signal.SIGKILL]:
    ps=census()
    for pid,v in reversed(list(ps.items())):
     if pid in owned and v['birth']==owned[pid]['birth']:
      try:
       os.kill(pid,sig)
       with (d/'SIGNALS.jsonl').open('a') as f:f.write(json.dumps({'pid':pid,'birth':v['birth'],'signal':sig.name})+'\n')
      except ProcessLookupError:pass
    time.sleep(2)
   child.wait(timeout=10)
 ps=census();remaining=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
 if remaining:
  reason=reason or 'cleanup-failure-owned-descendants'
  for sig in [signal.SIGTERM,signal.SIGKILL]:
   ps=census()
   for v in remaining:
    if v['pid'] in ps and ps[v['pid']]['birth']==v['birth']:
     try:os.kill(v['pid'],sig)
     except ProcessLookupError:pass
   time.sleep(2)
  ps=census();remaining=[v for v in remaining if v['pid'] in ps and ps[v['pid']]['birth']==v['birth']]
 bad=inputs();rc=child.returncode if child else None;classification='checked-sample-pass'
 if bad:reason=reason or 'input-drift-after-child'
 if reason:classification=reason;globalStop=reason
 elif rc!=0:
  stderr=(d/'stderr.log').read_text()
  if 'heap never settled' in stderr:classification='quiescence-unresolved';failedProfiles.add(s['profile'])
  elif 'AssertionError' in stderr:classification='semantic-assertion-failure';failedProfiles.add(s['profile'])
  else:classification='setup-import-or-child-failure';globalStop=classification
 else:
  try:output=json.loads((d/'stdout.json').read_text());validate(output,s,child.pid)
  except Exception as error:classification='invalid-measurement-output';selectedError=repr(error);globalStop=classification
 result={'id':s['id'],'ordinal':s['ordinal'],'profile':s['profile'],'size':s['size'],'arm':s['arm'],'label':s['label'],'exit':rc,'pid':child.pid if child else None,'classification':classification,'valid':classification=='checked-sample-pass','reason':reason,'validationError':selectedError,'remainingOwned':remaining,'inputMismatches':bad,'childInvocationElapsedSeconds':time.monotonic()-start,'telemetrySamples':len(observations),'maxObservedOwnedRssBytes':max((x['aggregateOwnedRssBytes'] for x in observations),default=None),'minimumObservedHostFreePercentage':min((x['memoryPressureFreePercentage'] for x in observations),default=None),'attempts':1}
 save(d/'RESULT.json',result);results.append(result);save(p/'STATUS.json',{'completedChildren':len(results),'maxChildren':84,'results':results,'failedProfiles':sorted(failedProfiles),'globalStop':globalStop,'currentChild':None});print('END',s['id'],classification,flush=True)
 if globalStop:break
final={'sourceMismatches':sources(),'inputMismatches':inputs(),'completedChildren':len(results),'validChildren':sum(x['valid'] for x in results),'failedProfiles':sorted(failedProfiles),'globalStop':globalStop,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};save(p/'AFTER.json',final)
if globalStop or failedProfiles or final['sourceMismatches'] or final['inputMismatches']:sys.exit(1)
