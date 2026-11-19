from pathlib import Path
import os,sys,json,time,subprocess,signal,datetime
w=Path(__file__).resolve().parent;c=Path(os.environ.get('ST_VERIFICATION_CANDIDATE','/Users/jonathanborgia/code/signaltree'));name=sys.argv[1];timeout=int(sys.argv[2]);argv=sys.argv[3:];d=w/'runs'/name;d.mkdir(parents=True,exist_ok=False)
def census():
 out={}
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,lstart='],text=True).splitlines():
  a=line.split()
  if len(a)>=7:out[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'birth':' '.join(a[2:])}
 return out
census();env=os.environ.copy()
for k in list(env):
 if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','NX_WORKSPACE_ROOT_PATH','NG_VERSION']:env.pop(k)
settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_CACHE_DIRECTORY':str(w/'nx-cache'),'NX_WORKSPACE_DATA_DIRECTORY':str(w/'nx-data'),'TMPDIR':str(d/'tmp'),'npm_config_cache':str(w/'npm-cache')}
for k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','npm_config_cache']:Path(settings[k]).mkdir(parents=True,exist_ok=True)
env.update(settings);(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'absoluteTimeoutSeconds':timeout,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n');owned={};timedout=False
with (d/'first.log').open('x') as log:
 child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);start=time.monotonic();(d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':child.pid})+'\n')
 while child.poll() is None:
  ps=census();ids={child.pid}|{pid for pid,v in owned.items() if pid in ps and ps[pid]['birth']==v['birth']}
  while True:
   added={pid for pid,v in ps.items() if v['ppid'] in ids}-ids
   if not added:break
   ids.update(added)
  for pid in ids:
   if pid in ps and pid not in owned:owned[pid]=ps[pid]
  (d/'OWNED.json').write_text(json.dumps(list(owned.values()),indent=2)+'\n')
  if time.monotonic()-start>timeout:timedout=True;break
  time.sleep(1)
 if timedout:
  for sig in [signal.SIGTERM,signal.SIGKILL]:
   ps=census()
   for pid,v in reversed(list(ps.items())):
    if pid in owned and v['birth']==owned[pid]['birth']:
     try:os.kill(pid,sig)
     except ProcessLookupError:pass
   time.sleep(2)
  child.wait(timeout=10)
ps=census();remaining=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']];result={'exit':child.returncode,'timeout':timedout,'remainingOwned':remaining,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};(d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');(d/'EXIT').write_text(str(child.returncode)+'\n');print(name,json.dumps(result),flush=True)
