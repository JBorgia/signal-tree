import os,sys,json,time,subprocess,signal,hashlib
from pathlib import Path
root=Path('/private/tmp/st-c28-r3-lint-repair');arm,name=sys.argv[1:3];c=root/arm;r=root/'runs'/name;r.mkdir(parents=True,exist_ok=False);(r/'tmp').mkdir();env={k:v for k,v in os.environ.items() if not k.startswith('ST_') and k not in ['NODE_OPTIONS','NODE_PATH','VITEST_POOL_ID','VITEST_WORKER_ID']};env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'data'),TMPDIR=str(r/'tmp'),ST_STATE_TRACE=str(r/'trace.jsonl'))
cmd=['corepack','pnpm']+sys.argv[3:];(r/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':cmd,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_STATE_TRACE']},'capSeconds':180},indent=2));paths=list(c.glob('packages/*/src/**/*.ts'))+list(c.glob('packages/*/src/**/*.tsx'));hs={str(p.relative_to(c)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths};(r/'SOURCE.json').write_text(json.dumps(hs,indent=2))
with (r/'first.log').open('wb') as f:
 p=subprocess.Popen(cmd,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);(r/'PROCESS.json').write_text(json.dumps({'pid':p.pid,'pgid':p.pid}));timeout=False
 try:p.wait(timeout=180)
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
result={'exit':p.returncode,'timeout':timeout,'sourceUnchanged':all(hashlib.sha256((c/k).read_bytes()).hexdigest()==v for k,v in hs.items())};(r/'RESULT.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));print((r/'first.log').read_text()[-5000:])
