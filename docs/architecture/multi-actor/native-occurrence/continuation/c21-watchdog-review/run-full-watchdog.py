import os,sys,json,time,hashlib,subprocess,signal
from pathlib import Path
root=Path(__file__).resolve().parent; dest=root/'runs'/'full-kernel-watchdog';dest.mkdir(parents=True,exist_ok=False)
progress=dest/'progress';reporter=root/'progress-reporter.mjs'
manifest=json.loads((root/'SNAPSHOT-C21.json').read_text())
def identity():return {p:hashlib.sha256((root/'candidate'/p).read_bytes()).hexdigest() for p in manifest}
before=identity();assert before==manifest
(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
for d in ['tmp','nx-cache','nx-data']:(root/d).mkdir(exist_ok=True)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(root/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(root/'nx-data'),TMPDIR=str(root/'tmp'),ST_VERIFY_PROGRESS=str(progress),ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'),NODE_OPTIONS='--require='+str(root/'diagnostic-redirect.cjs'))
(dest/'observations').mkdir();env.pop('NODE_PATH',None)
argv=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(reporter)]
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_VERIFY_PROGRESS','ST_PREPARED_REVIEW_OUTPUT','NODE_OPTIONS']},'noProgressCeilingSeconds':180,'timeoutSignal':'SIGTERM','reporterSha256':hashlib.sha256(reporter.read_bytes()).hexdigest()},indent=2)+'\n')
last=None;record=None;trigger=None
with (dest/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=root/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 pgid=os.getpgid(child.pid);assert pgid==child.pid
 (dest/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid},indent=2)+'\n')
 changed=time.monotonic()
 while child.poll() is None:
  try:
   raw=Path(str(progress)+'.current.json').read_text();current=json.loads(raw)
   if raw!=last:last=raw;record=current;changed=time.monotonic()
  except (FileNotFoundError,json.JSONDecodeError):pass
  if time.monotonic()-changed>180:
   trigger={'reason':'no-progress-180s','lastProgress':record,'ownedPgid':pgid}
   (dest/'WATCHDOG.json').write_text(json.dumps(trigger,indent=2)+'\n')
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   break
  time.sleep(.2)
 code=child.poll()
try:os.killpg(pgid,0);present=True
except ProcessLookupError:present=False
after=identity();result={'exit':code,'watchdog':trigger,'ownedGroupStillPresent':present,'sourceUnchanged':before==after,'changed':[p for p in before if before[p]!=after[p]]}
(dest/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
sys.exit(124 if trigger else code if code is not None else 125)
