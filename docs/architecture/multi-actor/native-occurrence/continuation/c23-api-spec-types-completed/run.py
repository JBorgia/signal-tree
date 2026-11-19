import subprocess,json,hashlib,os,time,signal
from pathlib import Path
r=Path(__file__).resolve().parent;b=Path('/private/tmp/st-c23-declare-public-successor');c=b/'candidate';manifest=b/'SNAPSHOT-CANDIDATE.json';expected='081e2114166b06506da5ea4e9b25544de8f4b2214b9fd16e93a0ad2423d35aaa';assert hashlib.sha256(manifest.read_bytes()).hexdigest()==expected;m=json.loads(manifest.read_text())
def identity():return {p:hashlib.sha256((c/p).read_bytes()).hexdigest() for p in m}
def save(name,x):(r/name).write_text(json.dumps(x,indent=2)+'\n')
save('STAGE.json',{'stage':'verify-source-before'});before=identity();assert before==m;save('SOURCE-BEFORE.json',before)
for name in ['tmp','nx-cache','nx-data']:(r/name).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'))
for key in ['NODE_OPTIONS','NODE_PATH','ST_GC_ARM','ST_GC_OUTPUT','ST_PREPARED_REVIEW_OUTPUT']:env.pop(key,None)
argv=['/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node','tools/check-spec-types.mjs'];save('COMMAND.json',{'argv':argv,'cwd':str(c),'manifestSha256':expected,'node':'24.15.0','noProgressSeconds':180,'progressDefinition':'gate output bytes or new stage (compiler child first observed, compiler child exits); unchanged process census is not progress','tmp':env['TMPDIR']})
def census(pgid):
 p=subprocess.run(['ps','-axo','pid=,ppid=,pgid=,command='],capture_output=True,text=True);assert p.returncode==0
 return [line for line in p.stdout.splitlines() if len(line.split())>3 and line.split()[2]==str(pgid)]
trigger=None;events=[]
with (r/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);pgid=child.pid;save('PROCESS.json',{'supervisorPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid})
 stage='gate-started';last=time.monotonic();size=0;seenCompiler=False
 while child.poll() is None:
  rows=census(pgid);compiler=any('/node_modules/typescript/bin/tsc' in x for x in rows)
  nextStage='compiler-running' if compiler else 'gate-processing' if seenCompiler else 'gate-started'
  if compiler:seenCompiler=True
  current=(r/'first.log').stat().st_size
  if current!=size or nextStage!=stage:
   size=current;stage=nextStage;last=time.monotonic();event={'stage':stage,'outputBytes':size,'ownedProcesses':rows};events.append(event);save('STAGE.json',event);save('PROGRESS.json',events)
  if time.monotonic()-last>180:
   trigger={'reason':'no-progress-180s','stage':stage,'outputBytes':size,'ownedProcesses':rows};save('WATCHDOG.json',trigger)
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:pass
   if census(pgid):
    try:os.killpg(pgid,signal.SIGKILL)
    except ProcessLookupError:pass
   break
  time.sleep(1)
 child.wait()
remaining=census(pgid);save('STOP-VERIFICATION.json',{'remainingOwnedProcesses':remaining});save('STAGE.json',{'stage':'verify-source-after','gateExit':child.returncode,'watchdog':trigger})
after=identity();save('SOURCE-AFTER.json',after);result={'exit':child.returncode,'watchdog':trigger,'compilerObserved':seenCompiler,'sourceUnchanged':after==m,'changed':[p for p in m if m[p]!=after[p]],'remainingOwnedProcesses':remaining};save('RESULT.json',result);save('STAGE.json',{'stage':'complete',**result});print(json.dumps(result),flush=True)
