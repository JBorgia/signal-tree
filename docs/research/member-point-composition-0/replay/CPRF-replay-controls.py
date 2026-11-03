#!/usr/bin/env python3
"""Replay 37 scoped controls plus corrected positive work probe from repository patches.
Requires extracted assets st-CPRF-final-portable-plan.json, operation-work-v2.mjs,
operation-work-runner-template.mjs; complete research packets and git19a5bd03.
No worktree overlay. Each run bundles exact baseline+patches in output directory.
"""
import argparse,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--assets',type=Path,default=Path(__file__).parent);a=p.parse_args();a.root=a.root.resolve();a.output.mkdir(parents=True,exist_ok=False)
plan=json.loads((a.assets/'st-CPRF-final-portable-plan.json').read_text());env=dict(os.environ,ST_PROOF_OUTPUT=str(a.output/'runs'),ST_PROOF_DEPS=str(a.root));results=[]
for j in plan['portable']:
 cmd=[s.replace('<FINAL_LANE>','CPRF').replace('<FRESH_LABEL>','replay-first') for s in j['command']]
 r=subprocess.run(cmd,cwd=a.root,env=env,capture_output=True,text=True,timeout=90);results.append({'command':cmd,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr});(a.output/'results.json').write_text(json.dumps(results,indent=2))
packet=a.root/'docs/research/member-point-composition-0'
s=(a.assets/'operation-work-runner-template.mjs').read_text();old='/Users/jonathanborgia/.codex/worktrees/atomic-capture-proof/signaltree';s=s.replace(old,str(a.root)).replace('/private/tmp/st-operation-instrument-CPRF-v2',str(a.output))
(a.output/'operation-work-v2.mjs').write_bytes((a.assets/'operation-work-v2.mjs').read_bytes());(a.output/'work-runner.mjs').write_text(s)
cmd=['node',str(a.output/'work-runner.mjs'),'CPRF','operation-work-v2.mjs','suite','positive-first'];r=subprocess.run(cmd,cwd=a.root,env=env,capture_output=True,text=True,timeout=90);results.append({'command':cmd,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr});(a.output/'results.json').write_text(json.dumps(results,indent=2));raise SystemExit(any(x['exit'] for x in results))
