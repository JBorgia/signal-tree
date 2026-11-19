from ownership import OwnedProcesses
from pathlib import Path
import subprocess,os,time,json,signal

def append(path,row):
 with path.open('a') as f:f.write(json.dumps(row)+'\n')
def run(argv,cwd,env,dest,startup=180,case_limit=90):
 dest.mkdir(exist_ok=False)
 (dest/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(cwd),'startupSeconds':startup,'activeCaseSeconds':case_limit,'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k in ['CI','VITEST_MAX_WORKERS','NODE_OPTIONS','NODE_ENV','NODE_COMPILE_CACHE','UV_THREADPOOL_SIZE','PATH','TMPDIR']}},indent=2)+'\n')
 with (dest/'first.log').open('w') as log:
  child=subprocess.Popen(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  pgid=os.getpgid(child.pid);assert pgid==child.pid
  monitor=OwnedProcesses(child.pid,dest)
  (dest/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid},indent=2)+'\n')
  born=time.monotonic();last=born;offset=0;active={};starts=[];trigger=None;last_census=0
  def consume():
   nonlocal offset,last
   p=dest/'events.jsonl'
   if not p.exists():return
   with p.open() as f:
    f.seek(offset)
    while True:
     position=f.tell();line=f.readline()
     if not line or not line.endswith('\n'):offset=position;break
     event=json.loads(line);offset=f.tell();now=time.monotonic();last=now
     key=(event.get('file'),event.get('name'))
     # Translate recorded epoch age to monotonic time, rather than extending a late-observed start.
     if event['kind']=='case-start':
      active[key]=now-max(0,(time.time()*1000-event['at'])/1000);starts.append(event)
      append(dest/'observed-starts.jsonl',{'observedAt':time.time(),'event':event})
     if event['kind']=='case-end':active.pop(key,None)
  while child.poll() is None:
   consume();now=time.monotonic()
   if now-last_census>=.2:
    append(dest/'census.jsonl',{'at':time.time(),'ownedPgid':pgid,'rows':monitor.snapshot()});last_census=now
   overdue=[k for k,t in active.items() if now-t>=case_limit]
   if overdue or (not starts and now-born>=startup) or (starts and not active and now-last>=startup):
    trigger={'reason':'active-case-deadline' if overdue else 'startup-or-no-progress','cases':overdue,'ownedPgid':pgid,'at':time.time()}
    (dest/'WATCHDOG.json').write_text(json.dumps(trigger,indent=2)+'\n')
    try:monitor.terminate()
    except ProcessLookupError:pass
    try:child.wait(timeout=10)
    except subprocess.TimeoutExpired:pass
    break
   time.sleep(.05)
  consume()
  # Bounded exit observation, no escalation or retry.
  for _ in range(20):
   rows=monitor.snapshot();append(dest/'census.jsonl',{'at':time.time(),'ownedPgid':pgid,'afterExit':True,'rows':rows})
   if not rows:break
   time.sleep(.1)
  result={'exit':child.poll(),'watchdog':trigger,'caseStartsObserved':len(starts),'unclosedCases':list(active),'ownedGroupStillPresent':bool(rows)}
  (dest/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(dest.name,result,flush=True)
  return result
