import sys,json,subprocess,os,time,signal
from pathlib import Path
r=Path(__file__).resolve().parent;label=sys.argv[1];cmd=json.loads(sys.argv[2]);cwd=Path(sys.argv[3]) if len(sys.argv)>3 else r/'candidate';d=r/'runs'/label;d.mkdir();env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'))
for key in ['NODE_OPTIONS','NODE_PATH','ST_GC_ARM','ST_GC_SCENARIO','ST_GC_OUTPUT']:env.pop(key,None)
(d/'COMMAND.json').write_text(json.dumps({'argv':cmd,'cwd':str(cwd),'node':'24.15.0','noOutputDeadlineSeconds':180},indent=2));stop=False
with (d/'first.log').open('w') as f:
 p=subprocess.Popen(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);pgid=p.pid;(d/'PROCESS.json').write_text(json.dumps({'pid':p.pid,'pgid':pgid}));last=0;t=time.monotonic()
 while p.poll() is None:
  size=(d/'first.log').stat().st_size
  if size!=last:last=size;t=time.monotonic()
  if time.monotonic()-t>180:
   stop=True;os.killpg(pgid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(pgid,signal.SIGKILL)
   break
  time.sleep(.2)
 p.wait()
(d/'RESULT.json').write_text(json.dumps({'exit':p.returncode,'watchdog':stop}));print(label,p.returncode,flush=True)
