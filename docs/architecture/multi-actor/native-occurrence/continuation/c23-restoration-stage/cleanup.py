from pathlib import Path
import json,os,signal,time
from ownership import OwnedProcesses
r=Path(__file__).resolve().parent;d=r/'run-once';o=json.loads((d/'OWNERSHIP.json').read_text())
m=object.__new__(OwnedProcesses);m.known={int(p):b for p,b in o['knownBirths'].items()}
records=[]
def census():
 rows=m.scan();return [v for k,v in rows.items() if m.known.get(k)==v['birth']]
records.append({'kind':'before','at':time.time(),'rows':census()})
# Existing watchdog already issued TERM. Kill only exact surviving non-zombie identities.
for row in records[-1]['rows']:
 fresh={v['pid']:v for v in census()}.get(row['pid'])
 if fresh and fresh['birth']==row['birth'] and fresh['raw'].split()[3]!='Z':
  try:os.kill(row['pid'],signal.SIGKILL);records.append({'kind':'SIGKILL','at':time.time(),'witness':fresh})
  except ProcessLookupError:pass
for i in range(30):
 rows=census();records.append({'kind':'census','at':time.time(),'rows':rows})
 if not rows:break
 time.sleep(.2)
(d/'CLEANUP-FINAL.json').write_text(json.dumps({'records':records,'finalRows':rows,'liveNonZombieRemain':any(x['raw'].split()[3]!='Z' for x in rows)},indent=2)+'\n')
print(json.dumps({'finalRows':rows,'signals':[x for x in records if x['kind']=='SIGKILL']}))
