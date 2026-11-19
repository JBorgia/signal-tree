from pathlib import Path
import os,json,hashlib,subprocess,signal,shutil
p=Path(__file__).parent;node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for label in ['c27','c28']:
 cwd=p/(label+'-copy');m=json.loads((p/(label+'-MANIFEST.json')).read_text());f='packages/kernel/src/lib/opaque-current-input.spec.ts';shutil.copy2(p/'opaque-current-input.spec.ts',cwd/f)
 r=p/'runs'/label;r.mkdir(parents=True);(r/'tmp').mkdir()
 env=os.environ.copy();env.update(PATH=node+':'+env.get('PATH',''),NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),ST_OPAQUE_INPUT_OUTPUT=str(r/'observations.jsonl'))
 argv=[node+'/corepack','pnpm','nx','test','kernel','opaque-current-input','--skip-nx-cache','--maxWorkers=1']
 assert {f:h(cwd/f) for f in m}==m
 (r/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(cwd),'node':subprocess.check_output([node+'/node','--version'],text=True).strip(),'pnpm':subprocess.check_output([node+'/corepack','pnpm','--version'],cwd=cwd,env=env,text=True).strip(),'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_CACHED')) or k=='TMPDIR'},'timeoutSeconds':180},indent=2)+'\n')
 with (r/'first.log').open('w') as log:
  proc=subprocess.Popen(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);timeout=False
  (r/'PROCESS.json').write_text(json.dumps({'pid':proc.pid,'pgid':proc.pid})+'\n')
  try:code=proc.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(proc.pid,signal.SIGTERM)
   try:code=proc.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
 result={'exit':code,'timeout':timeout,'changedManifestFiles':[f for f in m if h(cwd/f)!=m[f]],'fixtureUnchanged':h(cwd/f)==h(p/'opaque-current-input.spec.ts')}
 (r/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(label,result,flush=True)
 if timeout:break
