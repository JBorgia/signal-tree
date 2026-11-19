from pathlib import Path
import os,json,subprocess,hashlib,signal
p=Path(__file__).parent;cwd=p/'candidate';manifest=json.loads((p/'BASE-MANIFEST.json').read_text());ids=json.loads((p/'IDENTITY.json').read_text());expected={**manifest,**ids['overlays']};node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin';env=os.environ.copy();env['PATH']=node+':'+env.get('PATH','');h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
files=['src/enhancers/restoration/restoration.spec.ts','src/lib/transaction-observer-failure.spec.ts','src/lib/opaque-leaf-restoration-v16-controls.spec.ts','src/enhancers/transactions/transaction-lifecycle-view.spec.ts']
for label,argv in [('affected-four-first',[node+'/corepack','pnpm','nx','test','kernel',*files,'--skip-nx-cache','--maxWorkers=1']),('spec-types-first',[node+'/node','tools/check-spec-types.mjs'])]:
 r=p/'runs'/label;r.mkdir(parents=True);(r/'tmp').mkdir()
 env.update(NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'))
 assert {f:h(cwd/f) for f in expected}==expected
 (r/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(cwd),'node':subprocess.check_output([node+'/node','--version'],text=True).strip(),'pnpm':subprocess.check_output([node+'/corepack','pnpm','--version'],cwd=cwd,env=env,text=True).strip(),'baseManifestSHA256':ids['manifestSHA256'],'verifiedBefore':len(expected),'env':{k:env[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR']},'timeoutSeconds':180},indent=2)+'\n')
 with (r/'first.log').open('w') as log:
  proc=subprocess.Popen(argv,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);(r/'PROCESS.json').write_text(json.dumps({'pid':proc.pid,'pgid':proc.pid})+'\n');timeout=False
  try:code=proc.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(proc.pid,signal.SIGTERM)
   try:code=proc.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);code=proc.wait()
 result={'exit':code,'timeout':timeout,'changedExpectedFiles':[f for f in expected if h(cwd/f)!=expected[f]],'runtimeUnchanged':all(h(cwd/f)==v for f,v in manifest.items() if f not in ids['overlays']),'overlaysUnchanged':all(h(cwd/f)==v for f,v in ids['overlays'].items())}
 (r/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(label,json.dumps(result),flush=True)
 if timeout:break
