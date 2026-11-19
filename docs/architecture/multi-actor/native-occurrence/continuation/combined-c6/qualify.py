import json,subprocess,sys
from pathlib import Path
r=Path(__file__).resolve().parent
shared=Path('/private/tmp/st-shared-construction-successor/runs')
c5=Path('/private/tmp/st-native-combined-c5/runs')
commands=[]
for name,source in [('construction-kernel',shared/'final-kernel'),('construction-angular',shared/'final-native'),('packet-accounting',c5/'aligned-accounting-packet')]:
 cmd=json.loads((source/'COMMAND.json').read_text())['argv']
 cmd=[x.replace('scalar-installation-accounting.spec.ts','scalar-install-accounting.spec.ts') for x in cmd]
 commands.append((name,cmd))
commands += [('retirement-enrollment',['corepack','pnpm','nx','test','kernel','--skip-nx-cache','fixed-window-independent.spec.ts','fixed-window-retirement.spec.ts','owner-transition-cancellation.spec.ts','occurrence-successor.spec.ts','enrollment-invariance.spec.ts','recipient-domain.spec.ts','--maxWorkers=1']),('source-types',['corepack','pnpm','exec','tsc','--noEmit','--pretty','false','-p','tsconfig.typecheck-all.json']),('spec-types',['node','tools/check-spec-types.mjs'])]
(r/'PREREGISTERED-COMMANDS.json').write_text(json.dumps(commands,indent=2)+'\n')
for name,cmd in commands:
 rc=subprocess.run([sys.executable,str(r/'run-gate.py'),name,*cmd]).returncode
 if rc:print('STOP first failure',name,flush=True);sys.exit(rc)
