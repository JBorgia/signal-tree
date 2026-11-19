from pathlib import Path
import os,sys,json
from watchdog_v2 import run
r=Path(__file__).resolve().parent;d=r/'control-detached'
x=run([sys.executable,str(r/'detached-control.py'),str(d)],r,os.environ.copy(),d,startup=5,case_limit=1)
signals=json.loads((d/'SIGNALS.json').read_text());ids=json.loads((d/'DETACHED.json').read_text())
assert x['exit']==0 and not x['ownedGroupStillPresent'] and x['caseStartsObserved']==1,x
assert {row['pgid'] for row in signals}=={ids['parentPid'],ids['childPgid']},signals
assert json.loads((d/'DETACHED-EXIT.json').read_text())['childExit']==-15
(r/'DETACHED-CONTROL-PASS.json').write_text(json.dumps({'ownedDescendantGroups':True,'detachedChildTerminated':True,'allObservedDescendantsExited':True,'caseStartRecorded':True},indent=2)+'\n')
