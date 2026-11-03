#!/usr/bin/env python3
"""Replay gates on an explicitly identified integrated checkout. No overlays.
Extract archive assets beside this script first. Dependencies: repository files,
Node/.nvmrc + pinned pnpm, installed lockfile dependencies. No gate ceiling edits.
Focused plan includes repeated test executions intentionally. --phase artifacts
writes fresh dist outputs; use a disposable checkout or back up wanted artifacts.
"""
import argparse,json,os,subprocess,time,signal
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--expect-head',required=True);p.add_argument('--phase',choices=['focused','preflight','full','artifacts'],required=True);p.add_argument('--assets',type=Path,default=Path(__file__).parent);a=p.parse_args()
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=a.root,text=True).strip()
if not head.startswith(a.expect_head):raise SystemExit('Unexpected HEAD '+head)
subprocess.run(['git','diff','--exit-code','HEAD','--','packages','tools','apps','scripts','package.json','pnpm-lock.yaml'],cwd=a.root,check=True)
a.output.mkdir(parents=True,exist_ok=False)
if a.phase in ['focused','full']:
 name='st-CPRE-focused-plan.json' if a.phase=='focused' else 'st-CPRF-full-plan.json';jobs=json.loads((a.assets/name).read_text())['jobs']
 if a.phase=='focused':jobs+=json.loads((a.assets/'st-CPRF-focused-plan.json').read_text())['jobs']
elif a.phase=='preflight':jobs=[{'label':'typecheck','command':['pnpm','run','typecheck']},{'label':'spec-types','command':['node','tools/check-spec-types.mjs']},{'label':'lint','command':['pnpm','nx','run-many','-t','lint','--projects=kernel,angular,react,vue,solid','--parallel=1']}]
else:
 jobs=[{'label':r['label'],'command':r['command']} for r in json.loads((a.assets/'integration-build-results.json').read_text())]
(a.output/'identity.json').write_text(json.dumps({'head':head,'phase':a.phase,'node':subprocess.check_output(['node','--version'],text=True).strip(),'pnpm':subprocess.check_output(['pnpm','--version'],cwd=a.root,text=True).strip()},indent=2))
results=[];env=dict(os.environ,NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
for j in jobs:
 start=time.monotonic();print('START',j['label'],flush=True)
 with (a.output/(j['label']+'.log')).open('w') as f:
  child=subprocess.Popen(j['command'],cwd=a.root,env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=child.wait(timeout=600)
  except subprocess.TimeoutExpired:
   os.killpg(child.pid,signal.SIGTERM)
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
   code=124
 results.append({**j,'exit':code,'seconds':round(time.monotonic()-start,3)});(a.output/'results.json').write_text(json.dumps(results,indent=2));print('END',j['label'],code,flush=True)
 if code and (a.phase!='artifacts' or j['label']=='build-all'):break
raise SystemExit(any(x['exit'] for x in results))
