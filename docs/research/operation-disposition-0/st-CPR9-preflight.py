import subprocess,json,hashlib,os,signal,time
from pathlib import Path
root=Path('/Users/jonathanborgia/.codex/worktrees/atomic-capture-proof/signaltree');out=Path('/private/tmp/st-CPR9-preflight');out.mkdir(exist_ok=False)
m=json.loads(Path('/private/tmp/st-operation-disposition/runs/CPR9-no-turn-footprints.mjs-suite-first/manifest.json').read_text());base=None
for x in m['inputs']:
 p=Path(x['path'])
 if any(part.startswith('CPR9-') for part in p.parts) and 'packages' in p.parts:
  assert hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256'];base=Path(*p.parts[:p.parts.index('packages')])
assert base
paths=[str(p.relative_to(base)) for p in sorted((base/'packages').rglob('*')) if p.is_file()];backup={p:(root/p).read_bytes() for p in paths}
for p,data in backup.items():
 target=out/'backup'/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
hashes=lambda:{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths};before=hashes();(out/'before.json').write_text(json.dumps(before,indent=2));results=[]
(out/'authorization-context.json').write_text(json.dumps({'prior_broader_request':'not executed; rejected while membership was red','resolved_condition':'CPR9 prior39 portable all pass including exact D2 13 subset; 284 focused Nx tests pass including unchanged known24 prior failures','focused_records':'/private/tmp/st-CPR9-focused/summary.json','new_direction':'Fresh parent authorization after focused gate and independent review; stop broadening on first failure'},indent=2))
env=dict(os.environ,NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
jobs=[('queued-stats',['pnpm','nx','test','kernel','--testFile=src/enhancers/transactions/queued-inspection-review.spec.ts','--testFile=src/lib/production-stats-guards.spec.ts','--maxWorkers=1'],180),('typecheck',['pnpm','run','typecheck'],300),('spec-types',['node','tools/check-spec-types.mjs'],300),('lint',['pnpm','nx','run-many','-t','lint','--projects=kernel,angular,react,vue,solid','--parallel=1'],300)]
try:
 for p in paths:(root/p).write_bytes((base/p).read_bytes())
 for label,cmd,timeout in jobs:
  identity=hashes();start=time.monotonic();timedout=False;print('START',label,flush=True)
  with (out/(label+'.log')).open('w') as log:
   process=subprocess.Popen(cmd,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
   try:code=process.wait(timeout=timeout)
   except subprocess.TimeoutExpired:
    timedout=True;os.killpg(process.pid,signal.SIGTERM)
    try:code=process.wait(timeout=10)
    except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);code=process.wait()
  assert identity==hashes();results.append({'label':label,'command':cmd,'exit':code,'timeout':timedout,'seconds':round(time.monotonic()-start,3),'runtime':identity});(out/'results.json').write_text(json.dumps(results,indent=2));print('END',label,code,flush=True)

finally:
 for p,data in backup.items():(root/p).write_bytes(data)
 after=hashes();(out/'after.json').write_text(json.dumps(after,indent=2));assert before==after;print('RESTORED EXACT BYTES',len(backup),flush=True)
