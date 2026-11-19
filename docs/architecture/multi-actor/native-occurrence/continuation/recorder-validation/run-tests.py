from pathlib import Path
import os,json,hashlib
from watchdog import run
r=Path(__file__).resolve().parent;d=r/'run-small';base=json.loads((r/'FULL-COMMAND.json').read_text());m=json.loads((r/'SNAPSHOT-C21.json').read_text())
assert (r/'CONTROLS-PASS.json').exists()
def identity():return {p:hashlib.sha256((r/'candidate'/p).read_bytes()).hexdigest() for p in m}
before=identity();assert before==m
(r/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
env=os.environ.copy();env.update(base['env'])
for k,p in [('NX_CACHE_DIRECTORY','nx-cache'),('NX_WORKSPACE_DATA_DIRECTORY','nx-data'),('TMPDIR','tmp')]:
 (r/p).mkdir(exist_ok=True);env[k]=str(r/p)
(r/'observations').mkdir(exist_ok=True)
env.update(ST_VERIFY_PROGRESS=str(d/'progress'),ST_PREPARED_REVIEW_OUTPUT=str(r/'observations'),ST_RECORDER_OUTPUT=str(d),NODE_OPTIONS='--require='+str(r/'diagnostic-redirect.cjs')+' --require='+str(r/'record-startup.cjs'))
env.pop('NODE_PATH',None)
argv=['corepack','pnpm','nx','test','kernel','src/lib/internals/diagnostics/owner-evidence-0.spec.ts','src/lib/internals/location-runtime.spec.ts','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(r/'progress-reporter.mjs'),'--reporter='+str(r/'recorder-reporter.mjs')]
result=run(argv,r/'candidate',env,d)
after=identity();(r/'SOURCE-AFTER.json').write_text(json.dumps(after,indent=2)+'\n')
raw=(d/'first.log').read_text();result.update(sourceUnchanged=before==after,has14Passed='14 passed (14)' in raw)
(r/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n')
assert result['exit']==0 and result['watchdog'] is None and result['caseStartsObserved']==14 and not result['unclosedCases'] and not result['ownedGroupStillPresent'] and result['sourceUnchanged'] and result['has14Passed'],result
