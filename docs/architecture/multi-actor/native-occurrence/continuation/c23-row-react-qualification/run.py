from pathlib import Path
import os,sys,json,subprocess,time,signal,hashlib
p=Path(__file__).resolve().parent;c=p/'candidate';name=sys.argv[1];d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False)
for f in ['tmp','nx-cache','nx-data']:(d/f).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'nx-data'),TMPDIR=str(d/'tmp'));env.pop('NODE_OPTIONS',None)
cmd=['corepack','pnpm','nx','test',name,'--skip-nx-cache','--maxWorkers=1']
if name=='kernel':cmd.insert(5,'direct-row-declaration-qualification.spec.ts')
else:assert name=='react';cmd.insert(5,'branch-declaration-qualification.spec.tsx')
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':cmd,'env':{k:v for k,v in env.items() if k.startswith('NX_') or k in ['PATH','TMPDIR']},'watchdog':{'noOutputSeconds':120,'totalSeconds':240,'ownedNewProcessGroup':True}},indent=2)+'\n')
base=json.loads((p/'BASE-MANIFEST.json').read_text());added=['packages/kernel/src/lib/direct-row-declaration-qualification.spec.ts','packages/react/src/branch-declaration-qualification.spec.tsx']
def identity():return {f:hashlib.sha256((c/f).read_bytes()).hexdigest() for f in list(base)+added}
before=identity();(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
start=time.monotonic();last=start;size=0;watchdog=None;actions=[]
with (d/'first.log').open('w') as log:
 child=subprocess.Popen(cmd,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 pgid=os.getpgid(child.pid);assert pgid==child.pid
 (d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':pgid,'owned':True},indent=2)+'\n')
 while child.poll() is None:
  now=time.monotonic();new=(d/'first.log').stat().st_size
  if new!=size:size=new;last=now
  if now-start>240 or now-last>120:
   watchdog='total' if now-start>240 else 'no-output';os.killpg(pgid,signal.SIGTERM);actions.append('SIGTERM owned group')
   try:child.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(pgid,signal.SIGKILL);actions.append('SIGKILL owned group after grace');child.wait()
   break
  time.sleep(0.25)
 exit=child.wait()
try:os.killpg(pgid,0);alive=True
except ProcessLookupError:alive=False
if alive:
 os.killpg(pgid,signal.SIGTERM);actions.append('SIGTERM residual owned group')
 for _ in range(20):
  time.sleep(0.25)
  try:os.killpg(pgid,0)
  except ProcessLookupError:alive=False;break
 if alive:os.killpg(pgid,signal.SIGKILL);actions.append('SIGKILL residual owned group')
after=identity();result={'exit':exit,'watchdog':watchdog,'actions':actions,'sourceUnchanged':before==after,'pid':child.pid,'pgid':pgid}
(d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(result)
