from pathlib import Path
import os,json,subprocess,signal,sys
b=Path('/private/tmp/st-c28-r3-dynamic-admission-review/implementation');o=b/sys.argv[1];o.mkdir();(o/'tmp').mkdir()
e={k:v for k,v in os.environ.items() if not k.startswith('ST_')};e.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+e['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(o/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(o/'data'),TMPDIR=str(o/'tmp'),ST_RESTORATION_WORK=str(o/'counts.jsonl'))
cmd=(['corepack','pnpm','exec','tsc','--noEmit','-p','tsconfig.typecheck-all.json'] if sys.argv[2]=='types' else ['corepack','pnpm','nx','test','kernel',*sys.argv[2:],'--skip-nx-cache','--maxWorkers=1']);(o/'COMMAND.json').write_text(json.dumps({'cwd':str(b/'candidate'),'argv':cmd,'env':{k:v for k,v in e.items() if k.startswith(('NX_','ST_')) or k=='TMPDIR'}},indent=2))
with (o/'first.log').open('w') as f:
 p=subprocess.Popen(cmd,cwd=b/'candidate',env=e,stdout=f,stderr=subprocess.STDOUT,start_new_session=True);(o/'PROCESS.json').write_text(json.dumps({'pid':p.pid,'pgid':p.pid}));timed=False
 try:p.wait(timeout=120)
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
(o/'RESULT.json').write_text(json.dumps({'exit':p.returncode,'timeout':timed}));print(p.returncode,timed)
