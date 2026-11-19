import os,json,time,hashlib,subprocess,signal
from pathlib import Path
r=Path(__file__).resolve().parent;c=r/'candidate';m=json.loads((r/'BASE-MANIFEST.json').read_text());ledger=json.loads((r/'LEDGER.json').read_text());requested=ledger['requested']
def identity():return {p:hashlib.sha256((c/p).read_bytes()).hexdigest() for p in m}
assert identity()==m
progress=r/'progress';env=os.environ.copy();settings=dict(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),ST_VERIFY_PROGRESS=str(progress),ST_PREPARED_REVIEW_OUTPUT=str(r/'observations'),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(r/'public-output'),NODE_OPTIONS='--require='+str(r/'diagnostic-redirect.cjs'))
env.update(settings);env.pop('NODE_PATH',None);env.pop('ST_POINT_ALLOCATION_OUTPUT',None)
argv=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(r/'progress-reporter.mjs'),*requested]
(r/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'settings':{k:v for k,v in settings.items() if k!='PATH'},'nodeBin':settings['PATH'].split(':')[0],'noProgressSeconds':180},indent=2)+'\n')
last=None;record=None;trigger=None;offset=0;seen=[]
with (r/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);pgid=os.getpgid(child.pid);assert pgid==child.pid
 (r/'PROCESS.json').write_text(json.dumps({'supervisor':os.getpid(),'child':child.pid,'ownedPgid':pgid},indent=2)+'\n');changed=time.monotonic()
 while child.poll() is None:
  try:
   raw=Path(str(progress)+'.current.json').read_text();current=json.loads(raw)
   if raw!=last:last=raw;record=current;changed=time.monotonic()
   if current.get('file') and current['file'].split('/packages/kernel/')[-1] not in requested:trigger={'reason':'unexpected-reporter-file','record':current}
  except (FileNotFoundError,json.JSONDecodeError):pass
  if time.monotonic()-changed>180:trigger={'reason':'no-progress-180s','lastProgress':record}
  if trigger:
   (r/'WATCHDOG.json').write_text(json.dumps(trigger,indent=2)+'\n')
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   try:os.killpg(pgid,signal.SIGKILL)
   except ProcessLookupError:pass
   child.wait();break
  time.sleep(.2)
 code=child.wait()
# Only this owned session; explicit cleanup record.
try:os.killpg(pgid,0);residual=True
except ProcessLookupError:residual=False
if residual:
 try:os.killpg(pgid,signal.SIGKILL)
 except ProcessLookupError:pass
 time.sleep(.3)
ps=subprocess.run(['ps','-axo','pid=,pgid=,command='],text=True,capture_output=True)
remaining=[x for x in ps.stdout.splitlines() if len(x.split())>1 and x.split()[1]==str(pgid)]
rows=[json.loads(x) for x in Path(str(progress)+'.jsonl').read_text().splitlines()] if Path(str(progress)+'.jsonl').exists() else []
starts=[x['file'].split('/packages/kernel/')[-1] for x in rows if x['kind']=='module-start'];ends=[x['file'].split('/packages/kernel/')[-1] for x in rows if x['kind']=='module-end']
actual={'started':starts,'ended':ends,'unexpected':sorted(set(starts+ends)-set(requested)),'missingStart':sorted(set(requested)-set(starts)),'missingEnd':sorted(set(requested)-set(ends)),'duplicateStarts':len(starts)!=len(set(starts)),'duplicateEnds':len(ends)!=len(set(ends))}
(r/'ACTUAL-REPORTER-SET.json').write_text(json.dumps(actual,indent=2)+'\n');after=identity()
result={'exit':code,'watchdog':trigger,'sourceUnchanged':after==m,'changed':[p for p in m if after[p]!=m[p]],'requested':len(requested),'started':len(starts),'ended':len(ends),'toolingSetMismatch':any(actual[k] for k in ['unexpected','missingStart','missingEnd','duplicateStarts','duplicateEnds']),'residualGroupCleanup':residual,'remainingOwnedProcesses':remaining,'psExit':ps.returncode}
(r/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
