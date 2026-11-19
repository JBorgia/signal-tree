from pathlib import Path
import os,json,subprocess,hashlib,signal
out=Path(__file__).parent;identity=json.loads((out/'SOURCE-IDENTITY.json').read_text());nodebin='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin'
for version in ['C25','C26']:
 cwd=Path(identity[version]['copy']);run=out/'runs'/version;run.mkdir(parents=True,exist_ok=True)
 env=os.environ.copy();env.update(PATH=nodebin+':'+env.get('PATH',''),NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(run/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(run/'nx-data'),TMPDIR=str(run/'tmp'))
 (run/'tmp').mkdir(exist_ok=True)
 argv=[nodebin+'/corepack','pnpm','nx','test','kernel','scalar-horizon-lifecycle-controls','--skip-nx-cache','--maxWorkers=1']
 versions={name:subprocess.check_output(cmd,cwd=cwd,env=env,text=True).strip() for name,cmd in [('node',[nodebin+'/node','--version']),('pnpm',[nodebin+'/corepack','pnpm','--version'])]}
 (run/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(cwd),'versions':versions,'env':{k:env[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR']},'launchTimeoutSeconds':180},indent=2)+'\n')
 with (run/'first.log').open('w') as log:
  proc=subprocess.Popen(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (run/'PROCESS.json').write_text(json.dumps({'pid':proc.pid,'pgid':proc.pid})+'\n')
  timeout=False
  try:code=proc.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(proc.pid,signal.SIGTERM)
   try:code=proc.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
 changed=[f for f,h in identity[version]['sourceFiles'].items() if hashlib.sha256((cwd/f).read_bytes()).hexdigest()!=h]
 overlay=identity[version]['overlay'];overlaySame=hashlib.sha256((cwd/overlay).read_bytes()).hexdigest()==identity[version]['overlaySha256']
 result={'exit':code,'timeout':timeout,'changedSourceFiles':changed,'testOverlayUnchanged':overlaySame}
 (run/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(version,json.dumps(result),flush=True)
 if timeout:break
