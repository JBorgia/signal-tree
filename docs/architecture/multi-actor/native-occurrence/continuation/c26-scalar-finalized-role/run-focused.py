import os,sys,json,time,subprocess,signal,hashlib
from pathlib import Path
root=Path('/private/tmp/st-c26-scalar-finalized-role');c=root/'candidate';name=sys.argv[1];args=sys.argv[2:];r=root/'runs'/name;r.mkdir(parents=True)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'));(r/'tmp').mkdir()
cmd=['corepack','pnpm','nx']+args
(r/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':cmd,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR']},'ownedGroupCapSeconds':180},indent=2))
files=list(c.glob('packages/*/src/**/*.ts'))+list(c.glob('packages/*/src/**/*.tsx')); hashes={str(p.relative_to(c)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files};(r/'SOURCE.json').write_text(json.dumps(hashes,indent=2))
with (r/'first.log').open('wb') as f:
 p=subprocess.Popen(cmd,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);(r/'PROCESS.json').write_text(json.dumps({'pid':p.pid,'pgid':p.pid}));start=time.monotonic();timeout=False
 while p.poll() is None:
  if time.monotonic()-start>180:
   timeout=True;os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
   break
  time.sleep(.5)
(r/'RESULT.json').write_text(json.dumps({'exit':p.returncode,'timeout':timeout,'sourceUnchanged':all(hashlib.sha256((c/k).read_bytes()).hexdigest()==h for k,h in hashes.items())},indent=2))
print((r/'RESULT.json').read_text());print((r/'first.log').read_text()[-9000:])
