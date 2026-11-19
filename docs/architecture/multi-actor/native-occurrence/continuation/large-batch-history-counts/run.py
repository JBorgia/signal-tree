import os,sys,subprocess,json,time,hashlib,signal
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1];size=int(sys.argv[2]);repeats=int(sys.argv[3]);dest=root/'runs'/name;dest.mkdir(parents=True,exist_ok=False)
assert (size,repeats) in [(128,8),(128,1),(256,1),(1024,1)]
for d in ['nx-cache','nx-data']:(root/d).mkdir(exist_ok=True)
(dest/'tmp').mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(root/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(root/'nx-data'),TMPDIR=str(dest/'tmp'),ST_TRACE_SIZE=str(size),ST_TRACE_REPEATS=str(repeats),ST_TRACE_SITES=(root/'EXPECTED-SITES.json').read_text())
for key in ['NODE_PATH','ST_PREPARED_REVIEW_OUTPUT','ST_POINT_ALLOCATION_OUTPUT']:env.pop(key,None)
argv=['corepack','pnpm','nx','test','kernel','large-batch-history-count-probe.spec.ts','--skip-nx-cache','--maxWorkers=1']
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_TRACE_SIZE','ST_TRACE_REPEATS','ST_TRACE_SITES']},'watchdogSeconds':60,'start_new_session':True},indent=2))
def identity():
 paths=set(json.loads((root/'BASE-MANIFEST.json').read_text()))|{'packages/kernel/src/lib/large-batch-history-count-probe.spec.ts'}
 return {f:hashlib.sha256((root/'candidate'/f).read_bytes()).hexdigest() for f in sorted(paths)}
before=identity();(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2));start=time.monotonic();timed_out=False
with (dest/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=root/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 pgid=os.getpgid(child.pid);assert pgid==child.pid
 (dest/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid,'watchdogSeconds':60},indent=2))
 try:code=child.wait(timeout=60)
 except subprocess.TimeoutExpired:
  timed_out=True
  (dest/'WATCHDOG.json').write_text(json.dumps({'action':'SIGKILL owned subprocess group','pgid':pgid,'elapsedSeconds':time.monotonic()-start,'phaseEvidence':'tmp/phases.jsonl','logEvidence':'first.log'},indent=2))
  try:os.killpg(pgid,signal.SIGKILL)
  except ProcessLookupError:pass
  code=child.wait()
result={'exit':code,'watchdogTriggered':timed_out,'elapsedSeconds':time.monotonic()-start,'sourceUnchanged':before==identity()}
(dest/'RESULT.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True);sys.exit(124 if timed_out else code)
