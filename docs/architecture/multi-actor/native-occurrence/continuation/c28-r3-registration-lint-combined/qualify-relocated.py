from pathlib import Path
import subprocess,json
r=Path(__file__).resolve().parent
jobs=[('source-types-relocated',['exec','tsc','--noEmit','-p','tsconfig.typecheck-all.json']),('public-types-relocated',['exec','tsc','--noEmit','-p','packages/kernel/tsconfig.typecheck.json']),('spec-types-relocated',['exec','node','tools/check-spec-types.mjs']),('lint-local-fixtures',['exec','node',str(r/'lint-with-graph.cjs')])]
for n,a in jobs:
 print('START',n,flush=True)
 with (r/(n+'-runner.log')).open('x') as f:subprocess.run(['python3',str(r/'run.py'),'candidate',n,*a],stdout=f,stderr=subprocess.STDOUT)
 j=json.loads((r/'runs'/n/'RESULT.json').read_text());print('END',n,j,flush=True)
 if j['exit'] or j['timeout'] or not j['sourceUnchanged']:break
