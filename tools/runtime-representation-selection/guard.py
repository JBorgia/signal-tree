from pathlib import Path
import os,sys,json,time,subprocess,signal,datetime,re,hashlib
w=Path(__file__).resolve().parent;c=Path(os.environ.get('ST_VERIFICATION_CANDIDATE','/Users/jonathanborgia/code/signaltree/.worktrees/v16-sparse-responsibility-0'));name=sys.argv[1];timeout=int(sys.argv[2]);argv=sys.argv[3:];d=w/'runs'/name;d.mkdir(parents=True,exist_ok=False)
manifestBytes=(w/'MANIFEST.json').read_bytes();manifestDigest=hashlib.sha256(manifestBytes).hexdigest();manifest=json.loads(manifestBytes);manifestDirectory=w/'manifests';manifestDirectory.mkdir(exist_ok=True);manifestPath=manifestDirectory/(manifestDigest+'.json')
if manifestPath.exists():assert manifestPath.read_bytes()==manifestBytes
else:manifestPath.write_bytes(manifestBytes)
def census():
 out={}
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,rss=,lstart='],text=True,timeout=30).splitlines():
  a=line.split()
  if len(a)>=8:out[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'rssBytes':int(a[2])*1024,'birth':' '.join(a[3:])}
 return out
def host():
 raw=subprocess.check_output(['/usr/bin/memory_pressure','-Q'],text=True,timeout=5)
 match=re.search(r'System-wide memory free percentage:\s*(\d+(?:\.\d+)?)%',raw)
 if not match:raise RuntimeError('host telemetry unavailable')
 return float(match[1])
def verify():
 return [n for n,h in manifest.items() if hashlib.sha256((c/n).read_bytes()).hexdigest()!=h]
assert not verify(),'source drift before invocation'
assert host()>=25,'host floor preflight'
census();env=os.environ.copy()
for k in list(env):
 if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','NX_WORKSPACE_ROOT_PATH','NG_VERSION','FORCE_COLOR','NO_COLOR']:env.pop(k)
settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_CACHE_DIRECTORY':str(w/'nx-cache'),'NX_WORKSPACE_DATA_DIRECTORY':str(w/'nx-data'),'TMPDIR':str(d/'tmp'),'npm_config_cache':str(w/'npm-cache')}
for k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','npm_config_cache']:Path(settings[k]).mkdir(parents=True,exist_ok=True)
env.update(settings);(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'sourceManifestSha256':manifestDigest,'sourceManifestFile':str(manifestPath),'absoluteTimeoutSeconds':timeout,'noLogProgressTimeoutSeconds':900,'processCensusTimeoutSeconds':30,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n');owned={};timedout=False;reason=None;lastProgress=time.monotonic();lastSize=0;maxRss=0;minFree=100
with (d/'first.log').open('x') as log:
 child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);start=time.monotonic();(d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':child.pid})+'\n')
 while child.poll() is None:
  censusStart=time.monotonic()
  try:ps=census()
  except Exception as error:reason='process telemetry unavailable: '+repr(error);timedout=True;break
  censusLatency=time.monotonic()-censusStart;ids={child.pid}|{pid for pid,v in owned.items() if pid in ps and ps[pid]['birth']==v['birth']}
  while True:
   added={pid for pid,v in ps.items() if v['ppid'] in ids}-ids
   if not added:break
   ids.update(added)
  for pid in ids:
   if pid in ps and pid not in owned:owned[pid]=ps[pid]
  (d/'OWNED.json').write_text(json.dumps(list(owned.values()),indent=2)+'\n')
  live=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
  rss=sum(v['rssBytes'] for v in live);maxRss=max(maxRss,rss)
  hostStart=time.monotonic()
  try:free=host()
  except Exception as error:reason='telemetry unavailable: '+repr(error);timedout=True;break
  minFree=min(minFree,free);now=time.monotonic();size=(d/'first.log').stat().st_size
  if size!=lastSize:lastProgress=now;lastSize=size
  with (d/'telemetry.jsonl').open('a') as t:t.write(json.dumps({'elapsed':now-start,'perPid':live,'aggregateRssBytes':rss,'hostFreePercentage':free,'censusLatencySeconds':censusLatency,'hostLatencySeconds':now-hostStart})+'\n')
  if rss>4*1024**3:reason='aggregate owned RSS above4GiB'
  elif free<25:reason='host memory_pressure below25%'
  elif now-start>timeout:reason='absolute invocation timeout'
  elif now-lastProgress>900:reason='no log progress900s'
  if reason:timedout=True;break
  time.sleep(1)
 if timedout:
  if child.poll() is None:
   try:os.killpg(child.pid,signal.SIGTERM)
   except ProcessLookupError:pass
  for sig in [signal.SIGTERM,signal.SIGKILL]:
   ps=census()
   for pid,v in reversed(list(ps.items())):
    if pid in owned and v['birth']==owned[pid]['birth']:
     try:os.kill(pid,sig)
     except ProcessLookupError:pass
   time.sleep(2)
  child.wait(timeout=10)
ps=census();remaining=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']];result={'sourceManifestSha256':manifestDigest,'exit':child.returncode,'timeout':timedout,'guardReason':reason,'maxObservedOwnedRssBytes':maxRss,'minObservedHostFreePercentage':minFree,'sourceMismatches':verify(),'remainingOwned':remaining,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};(d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');(d/'EXIT').write_text(str(child.returncode)+'\n');print(name,json.dumps(result),flush=True)
