import subprocess,json,hashlib,os,re,signal
from pathlib import Path
root=Path('/Users/jonathanborgia/.codex/worktrees/atomic-capture-proof/signaltree');out=Path('/private/tmp/st-CPR5-baseline-attribution');out.mkdir(exist_ok=False)
manifest=Path('/private/tmp/st-operation-disposition/runs/CPR5-omitted-leaf-replay.mjs-suite-cpr5-first/manifest.json');m=json.loads(manifest.read_text());base=None
for item in m['inputs']:
 p=Path(item['path'])
 if any(part.startswith('CPR5-') for part in p.parts) and 'packages' in p.parts:
  assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'];base=Path(*p.parts[:p.parts.index('packages')])
assert base
paths=[str(p.relative_to(base)) for p in (base/'packages').rglob('*') if p.is_file()];backup={p:(root/p).read_bytes() for p in paths}
for p,data in backup.items():
 target=out/'backup'/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
hashes=lambda:{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};before=hashes();(out/'before.json').write_text(json.dumps(before,indent=2));results=[];env=dict(os.environ,NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
def run(label,args):
 cmd=['pnpm','nx','test',*args,'--maxWorkers=1'];identity=hashes();print('START',label,flush=True);timedout=False
 with (out/(label+'.log')).open('w') as log:
  process=subprocess.Popen(cmd,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=process.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timedout=True;os.killpg(process.pid,signal.SIGTERM)
   try:code=process.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);code=process.wait()
 content=(out/(label+'.log')).read_text();failed=re.findall(r'× (.+?) \d+ms',content)
 results.append({'label':label,'command':cmd,'exit':code,'timeout':timedout,'failed':failed,'runtime':identity});(out/'results.json').write_text(json.dumps(results,indent=2));assert identity==hashes();print('END',label,code,failed,flush=True)
 return code,failed
def kernel(name,path):return run('kernel-'+name,['kernel','--testFile=packages/kernel/src/'+path])
try:
 for p in paths:(root/p).write_bytes(subprocess.check_output(['git','show','19a5bd03:'+p],cwd=root))
 prior={'files':['src/lib/production-stats-guards.spec.ts','src/enhancers/transactions/queued-inspection-review.spec.ts'],'pattern':'(?:are never the unbraced body of a control statement|preserves older status when a no-turn pending is confirmed|preserves older status when a no-turn pending is rollbacked)$'};code,failed=run('baseline-three',['kernel',*['--testFile='+f for f in prior['files']],'--testNamePattern='+prior['pattern']])

finally:
 for p,data in backup.items():(root/p).write_bytes(data)
 after=hashes();(out/'after.json').write_text(json.dumps(after,indent=2));assert before==after;print('RESTORED EXACT',len(paths),flush=True)
