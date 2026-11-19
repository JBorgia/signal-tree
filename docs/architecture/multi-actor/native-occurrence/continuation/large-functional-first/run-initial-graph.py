# Bounded adaptation of reader-verification/run.py and reader-memory/run-r1.py.
from pathlib import Path
import os,sys,json,hashlib,subprocess,time,signal,re,datetime
p=Path(__file__).resolve().parent;name=sys.argv[1];commands=json.loads((p/'COMMANDS.json').read_text());graph=name.startswith('graph-');arm=name[6:] if graph else next(x['arm'] for x in commands if x['id']==name)
c=Path('/private/tmp/st-v16-integration-candidate') if arm=='original' else p/'screen-candidate';manifest=p/('CANDIDATE-MANIFEST.json' if arm=='original' else 'SCREEN-MANIFEST.json');m=json.loads(manifest.read_text());d=p/'runs'/name
if (p/'STOP.json').exists():raise SystemExit('Protocol already stopped; no retries')
d.mkdir(parents=True,exist_ok=False)
def save(n,v): (d/n).write_text(json.dumps(v,indent=2)+'\n')
def digest(f):return hashlib.sha256(f.read_bytes()).hexdigest()
def verify():return [n for n,h in m.items() if not (c/n).is_file() or digest(c/n)!=h]
def census():
 out={}
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,rss=,lstart=,command='],text=True,timeout=5).splitlines():
  a=line.split(None,8)
  if len(a)==9:out[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'rssBytes':int(a[2])*1024,'birth':' '.join(a[3:8]),'command':a[8]}
 return out
MEMSIZE=34359738368;RSSCAP=2*1024**3;FREEFLOOR=12.5

def host():
 out=subprocess.check_output(['/usr/bin/memory_pressure','-Q'],text=True,timeout=5);match=re.search(r'System-wide memory free percentage:\s*(\d+(?:\.\d+)?)%',out)
 if not match:raise RuntimeError('free-percentage telemetry unavailable')
 return {'raw':out,'freePercentage':float(match[1])}
def guard(rss,free):
 if rss>RSSCAP:return 'aggregate-owned-rss-over2GiB'
 if free<FREEFLOOR:return 'host-free-percentage-below12.5'
 return None
assert guard(RSSCAP,FREEFLOOR) is None and guard(RSSCAP+1,99) and guard(0,12.49)
settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+os.environ['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_WORKSPACE_DATA_DIRECTORY':str(p/('graph-'+arm)),'NX_CACHE_DIRECTORY':str(d/'cache'),'TMPDIR':str(d/'tmp'),'ST_SUITE_EVENTS':str(d/'events.jsonl')}
env=os.environ.copy()
for k in list(env):
 if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','NG_VERSION','NX_WORKSPACE_ROOT_PATH','SEMANTICS_REPORT']:env.pop(k)
env.update(settings)
for k in ['NX_WORKSPACE_DATA_DIRECTORY','NX_CACHE_DIRECTORY','TMPDIR']:Path(settings[k]).mkdir(parents=True,exist_ok=True)
case=None if graph else next(x for x in commands if x['id']==name);argv=['corepack','pnpm','nx','show','project','kernel','--json'] if graph else case['argv'];cap=180 if graph else 360
save('COMMAND.json',{'cwd':str(c),'argv':argv,'env':settings,'absoluteSeconds':cap,'structuredNoProgressSeconds':None if graph else 180,'aggregateOwnedRssCapBytes':RSSCAP,'hostMemoryBytes':MEMSIZE,'hostFreePercentageFloor':FREEFLOOR,'originalTestTimeoutMs':None if graph else case['originalTestTimeoutMs'],'manifestSha256':digest(manifest)})
reason=None;owned={};workers=set();child=None;events=[];telemetry=[];start=time.monotonic();last=start;seen=0;nextHash=start+10;lastEvent=None
try:
 if not graph:
  prior=json.loads((p/'runs'/('graph-'+arm)/'RESULT.json').read_text());assert prior['qualified'], 'exact-cwd graph setup not qualified'
  idx=commands.index(case)
  for prev in commands[:idx]:assert json.loads((p/'runs'/prev['id']/'RESULT.json').read_text())['qualified'],'earlier selected test not qualified'
 bad=verify();save('SOURCE-BEFORE.json',{'mismatches':bad});assert not bad,'source drift before launch'
 assert int(subprocess.check_output(['/usr/sbin/sysctl','-n','hw.memsize'],text=True,timeout=5).strip())==MEMSIZE,'host identity mismatch'
 initial=host();save('HOST-BEFORE.json',initial);reason=guard(0,initial['freePercentage'])
 if reason:raise RuntimeError(reason)
 ps=census()
 versions={k:subprocess.check_output(v,cwd=c,env=env,text=True,timeout=15).strip() for k,v in {'node':['node','--version'],'pnpm':['pnpm','--version']}.items()};assert versions=={'node':'v24.15.0','pnpm':'10.17.0'},versions
 deps={str(f):digest(f) for f in [c/'pnpm-lock.yaml',c/'node_modules/.pnpm/lock.yaml',c/'node_modules/.modules.yaml',c/'node_modules/vitest/package.json',c/'node_modules/nx/package.json']};save('DEPENDENCIES.json',{'versions':versions,'hashes':deps,'realNodeModules':str((c/'node_modules').resolve())})
 with (d/'first.log').open('x') as log:
  child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);start=time.monotonic();last=start;nextHash=start+10;save('PROCESS.json',{'pid':child.pid,'pgid':child.pid,'supervisorPid':os.getpid(),'launchMonotonic':start})
  while child.poll() is None:
   now=time.monotonic();ps=census();ids={child.pid}|{pid for pid,v in owned.items() if pid in ps and ps[pid]['birth']==v['birth']}
   while True:
    new={pid for pid,v in ps.items() if v['ppid'] in ids}-ids
    if not new:break
    ids.update(new)
   for pid in ids:
    if pid in ps and pid not in owned:owned[pid]=ps[pid]
   live=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
   workers.update(v['pid'] for v in live if '/vitest/' in v['command'] and '/workers/forks.js' in v['command'])
   save('OWNED.json',list(owned.values()))
   hs=host();rss=sum(v['rssBytes'] for v in live);sample={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elapsedSeconds':now-start,'ownedRssBytes':rss,'hostFreePercentage':hs['freePercentage'],'ownedPids':[v['pid'] for v in live]};telemetry.append(sample)
   with (d/'telemetry.jsonl').open('a') as f:f.write(json.dumps(sample)+'\n')
   eventfile=d/'events.jsonl';events=[]
   if eventfile.exists():
    for line in eventfile.read_text().splitlines():
     try:events.append(json.loads(line))
     except ValueError:pass
   structured=[e for e in events if e.get('kind') in ['run-start','module-start','case-start','case-result','module-end','run-end']]
   if len(structured)>seen:seen=len(structured);last=now;lastEvent=structured[-1]
   reason=guard(rss,hs['freePercentage'])
   if not reason and now>=nextHash:
    if verify():reason='source-drift'
    nextHash=now+10
   if not reason and now-start>=cap:reason='absolute-wall-time-limit'
   if not reason and not graph and now-last>=180:reason='structured-no-progress180s'
   if reason:break
   time.sleep(0.5)
except Exception as error:
 if not reason:reason='setup-or-telemetry-error: '+repr(error)
finally:
 if reason and child is not None and child.poll() is None:
  save('WATCHDOG.json',{'reason':reason,'lastStructuredEvent':lastEvent,'elapsedSeconds':time.monotonic()-start})
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
# A successful parent cannot excuse leaked owned descendants.
if remaining and not reason:reason='owned-descendant-survived-parent'
if remaining:
 for sig in [signal.SIGTERM,signal.SIGKILL]:
  ps=census()
  for v in remaining:
   if v['pid'] in ps and ps[v['pid']]['birth']==v['birth']:
    try:os.kill(v['pid'],sig)
    except ProcessLookupError:pass
  time.sleep(2)
 ps=census();remaining=[v for v in remaining if v['pid'] in ps and ps[v['pid']]['birth']==v['birth']]
events=[json.loads(line) for line in (d/'events.jsonl').read_text().splitlines()] if (d/'events.jsonl').exists() else []
cases=[v for e in events if e.get('kind')=='module-end' for v in e['cases']];passed=[v for v in cases if v['state']=='passed'];failed=[v for v in cases if v['state']=='failed'];bad=verify();depsAfter={f:digest(Path(f)) for f in deps} if 'deps' in locals() else {};depDrift=depsAfter!=deps if 'deps' in locals() else True
rc=child.returncode if child else None;qualified=rc==0 and not reason and not remaining and not bad and not depDrift
if not graph:
 previousWorkers={pid for f in (p/'runs').glob('*/RESULT.json') for pid in json.loads(f.read_text()).get('workerPids',[])}
 qualified=qualified and len(passed)==1 and passed[0]['name']==case['expectedName'] and not failed and len(workers)==1 and not previousWorkers.intersection(workers) and any(e.get('kind')=='run-end' and not e.get('errors') for e in events)
classification='graph-setup-pass' if qualified and graph else 'selected-case-pass' if qualified else reason or ('assertion-or-test-timeout' if failed else 'worker-start-or-selection-or-exit-failure')
r={'id':name,'arm':arm,'exit':rc,'qualified':bool(qualified),'classification':classification,'reason':reason,'cases':cases,'workerPids':sorted(workers),'remainingOwned':remaining,'sourceMismatches':bad,'dependencyDrift':depDrift,'telemetrySamples':len(telemetry),'maxObservedOwnedRssBytes':max((x['ownedRssBytes'] for x in telemetry),default=None),'minimumObservedHostFreePercentage':min((x['hostFreePercentage'] for x in telemetry),default=None),'elapsedSeconds':time.monotonic()-start,'attempts':1,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};save('RESULT.json',r)
if not qualified:(p/'STOP.json').write_text(json.dumps(r,indent=2)+'\n')
print(json.dumps(r),flush=True)
