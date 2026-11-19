from pathlib import Path
import os,sys,json,time,subprocess,hashlib
from ownership import OwnedProcesses
r=Path(__file__).resolve().parent;c=Path('/private/tmp/st-c23-row-react-declaration-qualification/candidate');name=sys.argv[1];d=r/'runs'/name;d.mkdir(parents=True)
for x in ['tmp','cache','data']:(d/x).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'data'),TMPDIR=str(d/'tmp'));env.pop('NODE_OPTIONS',None)
args=['corepack','pnpm','nx','test',name]+(['branch-declaration-qualification.spec.tsx'] if name=='react' else ['direct-row-declaration-qualification.spec.ts','neutral-branch-declaration-independent.spec.ts'])+['--skip-nx-cache','--maxWorkers=1']
if name=='neutral':args=['corepack','pnpm','nx','exec','--','pnpm','exec','vitest','run','--config',str(r/'vitest.config.mjs'),'--maxWorkers=1']
(d/'COMMAND.json').write_text(json.dumps({'argv':args,'cwd':str(c),'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR']},'bounds':{'noOutput':120,'total':240}},indent=2))
assert (r/'VERIFIED-INPUT.json').exists(), 'source verification must precede replay'
# Preflight census before launching; a failed sandbox must not orphan a new build.
OwnedProcesses.scan(None)
with (d/'first.log').open('w') as log:
 p=subprocess.Popen(args,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);monitor=OwnedProcesses(p.pid,d);start=last=time.monotonic();size=0;deadline=None
 while True:
  live=monitor.snapshot();now=time.monotonic();n=(d/'first.log').stat().st_size
  if n!=size:size=n;last=now
  if p.poll() is not None and not live:break
  if now-last>120 or now-start>240:
   deadline='no-output' if now-last>120 else 'total';monitor.terminate();break
  time.sleep(.5)
 code=p.poll()
 for _ in range(20):
  remaining=monitor.snapshot()
  if not remaining:break
  time.sleep(.25)
 result={'exit':code,'deadline':deadline,'remainingObservedDescendants':remaining};(d/'RESULT.json').write_text(json.dumps(result,indent=2));print(result,flush=True)
