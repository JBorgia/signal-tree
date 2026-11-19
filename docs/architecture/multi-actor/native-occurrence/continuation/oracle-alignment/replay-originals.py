from pathlib import Path
import subprocess
b=Path(__file__).parent;c=b/'candidate';lib=c/'packages/kernel/src/lib';names=['entity-egress-footprint','branch-omission-correctness','link-commit-ordering','link-commit-boundary-carrier'];saved={name:(lib/(name+'.spec.ts')).read_bytes() for name in names}
try:
 for name in names:(lib/(name+'.spec.ts')).write_bytes((b/'original-fixtures'/(name+'.spec.ts')).read_bytes())
 import os
 env=os.environ.copy();env.update(NX_DAEMON='false',NX_ISOLATE_PLUGINS='false')
 cmd=['/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/corepack','pnpm','nx','test','kernel','--testFile=entity-egress-footprint.spec.ts','branch-omission-correctness.spec.ts','link-commit-ordering.spec.ts','link-commit-boundary-carrier.spec.ts','--maxWorkers=1','--skip-nx-cache']
 with (b/'original-oracles-replay.log').open('w') as log:r=subprocess.run(cmd,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT)
 (b/'original-oracles-replay.exit').write_text(str(r.returncode)+'\n')
finally:
 for name,data in saved.items():(lib/(name+'.spec.ts')).write_bytes(data)
