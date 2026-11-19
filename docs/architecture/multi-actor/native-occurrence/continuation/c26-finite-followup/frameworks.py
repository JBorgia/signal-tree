from pathlib import Path
import json,subprocess,sys
r=Path('/private/tmp/st-c26-finite-followup')
assert json.loads((r/'runs/spec-types/RESULT.json').read_text())['exit']==0
for framework in ['angular','react','vue','solid']:
 name=framework+'-focused';files=['equal-owner-facade-controls']
 if framework=='solid':files.append('saved-inspection-snapshot-isolation')
 subprocess.run([sys.executable,str(r/'run-focused.py'),name,'test',framework,*files,'--skip-nx-cache','--maxWorkers=1'],check=True)
 result=json.loads((r/'runs'/name/'RESULT.json').read_text())
 if result['exit'] or result['timeout'] or not result['sourceUnchanged']:sys.exit(1)
