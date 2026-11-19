import json
from pathlib import Path
r=Path(__file__).resolve().parent
candidate=json.loads((r/'tmp/mixed-trace.json').read_text());baseline=json.loads((r/'baseline/tmp/mixed-trace.json').read_text())
def case(rows,write,settle):return next(x for x in rows if x['write']==write and x['settle']==settle)
c=case(candidate,'whole','confirm')['stages'];assert c[1]['sent']==[] and c[1]['x']['owners'][0][1]=='pending' and c[1]['y']['unknown'] is False and c[1]['y']['possible']==[]
assert c[2]['sent']==[[{'id':'a','x':7,'y':9}]]
for rows,write in [(candidate,'whole'),(candidate,'field'),(baseline,'field')]:
 stages=case(rows,write,'rollback')['stages'];assert stages[2]['value']=={'id':'a','x':0,'y':9} and stages[2]['sent']==[]
 assert stages[2]['x']['unknown'] is False and stages[2]['y']['unknown'] is False
 assert stages[3]['sent']==[[{'id':'a','x':0,'y':9}]]
 projections=[p for p in case(rows,write,'rollback')['projections'] if p['stage']=='rollback'];assert projections and projections[-1]['unknown'] and projections[-1]['possible'][0][1]=='pending'
terminal=json.loads((r/'tmp/whole-qualification.json').read_text());prior=json.loads((r/'baseline/tmp/whole-qualification.json').read_text())
assert [x['sameEndpoint'] for x in terminal]==[False,True]
assert [x['sameEndpoint'] for x in prior]==[True,True]
print('PASS: useful mixed confirmation, preserved native ownership, inherited rollback hold, terminal differences recorded')
