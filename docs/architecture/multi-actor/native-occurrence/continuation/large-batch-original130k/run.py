import os,sys,json,time,hashlib,subprocess,signal
from pathlib import Path
root=Path(__file__).resolve().parent;dest=root/'runs'/'single-original130k';dest.mkdir(parents=True,exist_ok=False)
for d in ['tmp','nx-cache','nx-data']:(root/d).mkdir(exist_ok=True)
stagefile=dest/'phases.jsonl'
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(root/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(root/'nx-data'),TMPDIR=str(root/'tmp'),ST_STAGE_LOG=str(stagefile))
for key in ['NODE_PATH','ST_PREPARED_REVIEW_OUTPUT','ST_POINT_ALLOCATION_OUTPUT']:env.pop(key,None)
argv=['corepack','pnpm','nx','test','kernel','large-batch-original130k-stage.spec.ts','--skip-nx-cache','--maxWorkers=1']
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_STAGE_LOG']},'startupCeilingSeconds':180,'afterTestStartCeilingSeconds':90,'timeoutSignal':'SIGTERM','start_new_session':True},indent=2))
def identity():
 paths=set(json.loads((root/'BASE-MANIFEST.json').read_text()))|{'packages/kernel/src/lib/large-batch-original130k-stage.spec.ts'}
 return {f:hashlib.sha256((root/'candidate'/f).read_bytes()).hexdigest() for f in sorted(paths)}
def phases():
 result=[]
 if stagefile.exists():
  for line in stagefile.read_text().splitlines():
   try:result.append(json.loads(line))
   except json.JSONDecodeError:pass
 return result
before=identity();(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2));trigger=None;test_deadline=None;records=[]
with (dest/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=root/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 spawned=time.monotonic();pgid=os.getpgid(child.pid);assert pgid==child.pid
 (dest/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid},indent=2))
 while child.poll() is None:
  records=phases()
  if test_deadline is None:
   starts=[r for r in records if r['stage']=='test-start']
   if starts:test_deadline=time.monotonic()+max(0,90-(time.time()-starts[0]['timeMs']/1000))
  now=time.monotonic()
  if (test_deadline is not None and now>=test_deadline) or (test_deadline is None and now-spawned>=180):
   trigger='after-test-start' if test_deadline is not None else 'startup'
   evidence={'trigger':trigger,'signal':'SIGTERM','ownedPgid':pgid,'lastStage':records[-1] if records else None,'observedPhases':len(records)}
   (dest/'WATCHDOG.json').write_text(json.dumps(evidence,indent=2))
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   break
  time.sleep(0.1)
 code=child.poll()
try:os.killpg(pgid,0);group_present=True
except ProcessLookupError:group_present=False
records=phases();result={'exit':code,'watchdog':trigger,'ownedGroupStillPresent':group_present,'lastStage':records[-1] if records else None,'phaseCount':len(records),'sourceUnchanged':before==identity()}
(dest/'RESULT.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
sys.exit(124 if trigger else (code if code is not None else 125))
