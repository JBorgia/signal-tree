from pathlib import Path
import json,subprocess,sys
r=Path('/private/tmp/st-c27-public-composition')
for name,args in [('source-types',['exec','tsc','--noEmit','-p','tsconfig.typecheck-all.json']),('public-types',['exec','tsc','--noEmit','-p','packages/kernel/tsconfig.typecheck.json']),('spec-types',['exec','node','tools/check-spec-types.mjs'])]:
 subprocess.run([sys.executable,str(r/'run-direct.py'),name,*args],check=True)
 result=json.loads((r/'runs'/name/'RESULT.json').read_text())
 if result['exit'] or result['timeout'] or not result['sourceUnchanged']:sys.exit(1)
