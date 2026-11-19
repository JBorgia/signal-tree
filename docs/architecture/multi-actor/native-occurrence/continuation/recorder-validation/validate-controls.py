from pathlib import Path
import sys,os,json
from watchdog import run
r=Path(__file__).resolve().parent
for mode in ['case','startup']:
 dest=r/('control-'+mode)
 result=run([sys.executable,str(r/'control-child.py'),str(dest),mode],r,os.environ.copy(),dest,startup=1.5,case_limit=1)
 assert result['exit']==-15 and not result['ownedGroupStillPresent'],result
 assert result['watchdog']['reason']==('active-case-deadline' if mode=='case' else 'startup-or-no-progress'),result
 assert result['caseStartsObserved']==(1 if mode=='case' else 0),result
(r/'CONTROLS-PASS.json').write_text(json.dumps({'caseDeadline':True,'startupDeadline':True,'onlyOwnedGroupsSignalled':True,'syntheticOnly':True},indent=2)+'\n')
