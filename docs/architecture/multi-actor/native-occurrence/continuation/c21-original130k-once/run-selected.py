from pathlib import Path
import os,json,subprocess,signal,time,hashlib,re
root=Path(__file__).resolve().parent;dest=root/'run-selected';dest.mkdir(exist_ok=False)
m=json.loads((root/'SNAPSHOT-C21.json').read_text());h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def identity():return {p:h(root/'candidate'/p) for p in m}
before=identity();assert before==m
(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
base=json.loads((root/'FULLRUN-COMMAND.json').read_text());env=os.environ.copy();env.update(base['env'])
for key,name in [('NX_CACHE_DIRECTORY','nx-cache'),('NX_WORKSPACE_DATA_DIRECTORY','nx-data'),('TMPDIR','tmp')]:
 (root/name).mkdir(exist_ok=True);env[key]=str(root/name)
(dest/'observations').mkdir();env.update(ST_VERIFY_PROGRESS=str(dest/'progress'),ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'),NODE_OPTIONS='--require='+str(root/'diagnostic-redirect.cjs'));env.pop('NODE_PATH',None)
name='entity batches larger than the argument limit > setAll, replace and clear with membership observed'
argv=['corepack','pnpm','nx','test','kernel','entity-large-batches.spec.ts','--testNamePattern='+re.escape('setAll, replace and clear with membership observed')+'$','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(root/'progress-reporter.mjs')]
(dest/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(root/'candidate'),'env':{k:env[k] for k in base['env']},'startupSeconds':180,'afterCaseStartSeconds':90,'targetFullName':name},indent=2)+'\n')
started=False;last=None;trigger=None;case_at=None
with (dest/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=root/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 pgid=os.getpgid(child.pid);assert pgid==child.pid
 (dest/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':pgid},indent=2)+'\n')
 born=time.monotonic()
 while child.poll() is None:
  try:
   current=json.loads((dest/'progress.current.json').read_text());last=current
   if current.get('kind')=='case-start' and current.get('name')==name and not started:
    assert current['file'].endswith('/entity-large-batches.spec.ts')
    started=True;case_at=time.monotonic();(dest/'CASE-START.json').write_text(json.dumps(current,indent=2)+'\n')
  except (FileNotFoundError,json.JSONDecodeError):pass
  elapsed=time.monotonic()-(case_at if started else born)
  if elapsed>(90 if started else 180):
   trigger={'reason':'case-start-90s' if started else 'startup-180s','lastProgress':last,'targetCaseStarted':started,'ownedPgid':pgid}
   (dest/'WATCHDOG.json').write_text(json.dumps(trigger,indent=2)+'\n')
   try:os.killpg(pgid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   break
  time.sleep(.1)
 code=child.poll()
try:os.killpg(pgid,0);present=True
except ProcessLookupError:present=False
after=identity();raw=(dest/'first.log').read_text();clean=re.sub(r'\x1b\[[0-9;]*m','',raw)
# Default reporter totals independently rule out zero-test success.
one_pass=bool(re.search(r'Tests\s+1 passed',clean))
result={'exit':code,'watchdog':trigger,'targetCaseStartObserved':started,'onePassedInDefaultReporter':one_pass,'ownedGroupStillPresent':present,'sourceUnchanged':before==after,'changed':[p for p in before if before[p]!=after[p]],'qualifiedPass':code==0 and not trigger and started and one_pass and before==after}
(dest/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
raise SystemExit(124 if trigger else 0 if result['qualifiedPass'] else 1)
