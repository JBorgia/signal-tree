from pathlib import Path
import os,json,hashlib,subprocess,time,signal
r=Path(__file__).resolve().parent;c=r/'candidate';frozen=Path('/private/tmp/st-c28-r3-comparator/candidate');manifest=json.loads((r/'BASE-MANIFEST.json').read_text());expected='e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def verify(base):return [p for p,v in manifest.items() if h(base/p)!=v]
def census():
 raw=subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,pgid=,lstart='],text=True)
 d={}
 for line in raw.splitlines():
  a=line.split();
  if len(a)>=8:d[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'pgid':int(a[2]),'birth':' '.join(a[3:])}
 return d
# Fail before launching tests if owned-process observation is unavailable.
census();statuses=[]
for project in ['kernel','angular','react','vue','solid']:
 assert not verify(c) and not verify(frozen)
 d=r/'full-runs'/project;d.mkdir(parents=True,exist_ok=False);env=os.environ.copy()
 for k in list(env):
  if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','SEMANTICS_REPORT']:env.pop(k)
 settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_CACHE_DIRECTORY':str(r/'full-cache'),'NX_WORKSPACE_DATA_DIRECTORY':str(r/'full-data'),'TMPDIR':str(d/'tmp'),'ST_PREPARED_REVIEW_OUTPUT':str(d/'observations'),'ST_PUBLIC_DIAGNOSTIC_OUTPUT':str(d/'public'),'ST_C21_DIAGNOSTIC_OUTPUT':str(d/'redirected'),'ST_TWO_HISTORY_OUTPUT':str(d/'two-history.jsonl'),'ST_EQUAL_OWNER_TRACE':str(d/'equal-owner.jsonl'),'ST_SUITE_EVENTS':str(d/'events.jsonl')}
 for k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_PREPARED_REVIEW_OUTPUT','ST_PUBLIC_DIAGNOSTIC_OUTPUT','ST_C21_DIAGNOSTIC_OUTPUT']:Path(settings[k]).mkdir(parents=True,exist_ok=True)
 if project!='angular':settings['NODE_OPTIONS']='--require='+str(r/'diagnostic-redirect.cjs')
 env.update(settings)
 argv=['corepack','pnpm','nx','test',project,'--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(r/'full-reporter.mjs')]
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'angularTargetRetainsOwnExposeGC':project=='angular','timeouts':{'startupSeconds':180,'noProgressSeconds':180,'absoluteSeconds':1800},'scope':'all ordinary discovered files; no filters/exclusions added'},indent=2)+'\n')
 (d/'SOURCE-BEFORE.json').write_text(json.dumps({'manifest':expected,'entries':len(manifest),'mismatches':[]},indent=2)+'\n')
 print('START',project,flush=True);start=time.monotonic();last=start;pos=0;buf='';lastEvent=None;reason=None;owned={}
 with (d/'first.log').open('x') as log:
  child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':child.pid,'supervisorPid':os.getpid()},indent=2)+'\n')
  while child.poll() is None:
   now=time.monotonic();ps=census();ids={child.pid}|set(owned)
   changed=True
   while changed:
    new={pid for pid,v in ps.items() if v['ppid'] in ids}-ids;changed=bool(new);ids.update(new)
   for pid in ids:
    if pid in ps and pid not in owned:owned[pid]=ps[pid]
   (d/'OWNED.json').write_text(json.dumps(list(owned.values()),indent=2)+'\n')
   events=d/'events.jsonl'
   if events.exists():
    with events.open() as stream:stream.seek(pos);data=stream.read();pos=stream.tell()
    buf+=data
    while '\n' in buf:
     line,buf=buf.split('\n',1)
     try:ev=json.loads(line)
     except ValueError:continue
     lastEvent=ev;last=now-min(1800,max(0,(time.time()*1000-ev['at'])/1000))
   if now-start>1800:reason='absolute-1800s'
   elif now-last>180:reason='no-progress-180s' if lastEvent else 'startup-180s'
   if reason:break
   time.sleep(1)
  if reason:
   (d/'WATCHDOG.json').write_text(json.dumps({'reason':reason,'lastEvent':lastEvent,'elapsedSeconds':time.monotonic()-start},indent=2)+'\n')
   for sig in [signal.SIGTERM,signal.SIGKILL]:
    ps=census();targets=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
    with (d/'SIGNALS.jsonl').open('a') as f:
     for v in reversed(targets):
      try:os.kill(v['pid'],sig);f.write(json.dumps({'pid':v['pid'],'birth':v['birth'],'signal':sig.name})+'\n')
      except ProcessLookupError:pass
    time.sleep(5)
   child.wait(timeout=10)
 code=child.returncode;ps=census();remain=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
 after={'candidateMismatches':verify(c),'frozenMismatches':verify(frozen)};(d/'SOURCE-AFTER.json').write_text(json.dumps(after,indent=2)+'\n')
 res={'project':project,'exit':code,'watchdog':reason,'elapsedSeconds':time.monotonic()-start,'remainingOwned':remain,'sourceUnchanged':not any(after.values()),'attempts':1}
 (d/'RESULT.json').write_text(json.dumps(res,indent=2)+'\n');statuses.append(res);(r/'FULL-STATUS.json').write_text(json.dumps(statuses,indent=2)+'\n');print('END',json.dumps(res),flush=True)
 if reason or remain or not res['sourceUnchanged'] or code is not None and code<0:break
