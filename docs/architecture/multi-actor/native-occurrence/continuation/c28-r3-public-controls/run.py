from pathlib import Path
import os,json,subprocess,hashlib,signal
p=Path(__file__).parent;cwd=p/'r2-copy';manifest=json.loads((p/'R2-MANIFEST.json').read_text());ids=json.loads((p/'IDENTITY.json').read_text());node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin';env=os.environ.copy();env['PATH']=node+':'+env.get('PATH','')
for label,argv in [('probes-first',[node+'/corepack','pnpm','nx','test','kernel','public-sibling-current-obligation','--skip-nx-cache','--maxWorkers=1']),('spec-types-first',[node+'/node','tools/check-spec-types.mjs'])]:
 r=p/'runs'/label;r.mkdir(parents=True,exist_ok=True);(r/'tmp').mkdir(exist_ok=True)
 env['ST_PUBLIC_SIBLING_OUTPUT']=str(r/'observations.jsonl')
 env.update(NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'))
 before={f:hashlib.sha256((cwd/f).read_bytes()).hexdigest() for f in manifest};assert before==manifest
 (r/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(cwd),'node':subprocess.check_output([node+'/node','--version'],text=True).strip(),'pnpm':subprocess.check_output([node+'/corepack','pnpm','--version'],cwd=cwd,env=env,text=True).strip(),'manifestSHA256':ids['manifestSHA256'],'verifiedBefore':len(before),'env':{k:env[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_PUBLIC_SIBLING_OUTPUT']},'timeoutSeconds':180},indent=2)+'\n')
 with (r/'first.log').open('w') as log:
  proc=subprocess.Popen(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);(r/'PROCESS.json').write_text(json.dumps({'pid':proc.pid,'pgid':proc.pid})+'\n');timeout=False
  try:code=proc.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(proc.pid,signal.SIGTERM)
   try:code=proc.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
 after={f:hashlib.sha256((cwd/f).read_bytes()).hexdigest() for f in manifest}
 result={'exit':code,'timeout':timeout,'changedManifestFiles':[f for f in manifest if after[f]!=manifest[f]],'overlayUnchanged':{f:hashlib.sha256((cwd/f).read_bytes()).hexdigest()==h for f,h in ids['overlays'].items()}}
 (r/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(label,json.dumps(result),flush=True)
 if timeout:break
