#!/usr/bin/env python3
"""Serial, preregistered fresh-process cohorts; refuses existing output."""
import hashlib
import json
import os
import platform
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
PACKET = Path(sys.argv[1]).resolve()
PHASE = sys.argv[2]
OUT = PACKET / (PHASE + '-runs')
OUT.mkdir(exist_ok=False)
NODE = shutil.which('node')
POLICY = json.loads((ROOT / 'tools/release-economics/policy.json').read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inventory():
    paths = [ROOT / 'tools/release-economics/policy.json', Path(__file__),
             ROOT / 'tools/lib/heap-quiescence.mjs']
    if PHASE == 'ordinary':
        paths += [ROOT / ('tools/release-economics/' + name) for name in ['ordinary.mjs','ordinary-child.mjs']]
        paths += [ROOT / path for path in [
            'apps/react-reference/src/app/reference-store.ts',
            'apps/demo/src/app/examples/features/fundamentals/examples/entities/entities-demo.component.ts',
            'apps/demo/src/app/pages/benchmarks/v15-benchmarks.component.ts']]
    else:
        paths += [ROOT / ('tools/release-economics/' + name) for name in ['coordinated.mjs','coordinated-child.mjs']]
    for arm in ['packed','v15']:
        paths += sorted((PACKET / (arm + '-kernel')).rglob('*'))
    return {str(p):digest(p) for p in paths if p.is_file()}

if PHASE == 'ordinary':
    profiles = [['cpu', p['kind'], str(p['rows'])] for p in POLICY['ordinaryProfiles']] + [['heap','jobs','1000']]
    reference = 'v15'
    script = ROOT / 'tools/release-economics/ordinary-child.mjs'
elif PHASE == 'coordinated':
    profiles = [['cpu'], ['heap']]
    reference = 'reference'
    script = ROOT / 'tools/release-economics/coordinated-child.mjs'
else:
    raise RuntimeError('Unknown phase')
schedule = []
for profile in profiles:
    for i in range(2):
        schedule.append(dict(role='aa', arm='packed', profile=profile, pair=i))
    for pair in range(5):
        for arm in ([reference,'packed'] if pair % 2 == 0 else ['packed',reference]):
            schedule.append(dict(role='comparison',arm=arm,profile=profile,pair=pair))
inputs = inventory()
plan = dict(createdAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            source=str(ROOT), node=NODE, nodeVersion=subprocess.check_output([NODE,'--version'],text=True).strip(),
            platform=platform.platform(), machine=platform.machine(),
            cpu=subprocess.check_output([NODE,'-p',"require('node:os').cpus()[0]?.model ?? 'unavailable in sandbox'"],text=True).strip(),
            initialLoad=os.getloadavg(), phase=PHASE, policy=POLICY,
            inputs=inputs,schedule=schedule,
            command=[sys.executable,*sys.argv], limits={'timeoutSeconds':180,'maxOldSpaceMiB':768})
(OUT/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
print('Registered',len(schedule),'serial children:',OUT,flush=True)
failures=[]
for index, row in enumerate(schedule):
    assert inventory() == inputs, 'Input drift before child'
    command = [NODE,'--expose-gc','--max-old-space-size=768',str(script),str(ROOT),str(PACKET),row['arm'],*row['profile']]
    before = os.getloadavg()
    start=time.time()
    with (OUT/f'{index:03}.out.json').open('w') as out, (OUT/f'{index:03}.err').open('w') as err:
        result=subprocess.run(command,stdout=out,stderr=err,timeout=180)
    receipt=dict(**row,index=index,command=command,exit=result.returncode,elapsedSeconds=time.time()-start,loadBefore=before,loadAfter=os.getloadavg())
    (OUT/f'{index:03}.receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
    assert inventory() == inputs, 'Input drift after child'
    print(json.dumps(receipt),flush=True)
    output=json.loads((OUT/f'{index:03}.out.json').read_text())
    if result.returncode:
        if result.returncode==1 and output.get('checks',{}).get('actualResourcesCollected') is False:
            failures.append(dict(index=index,reason='actualResourcesCollected=false',exit=1))
        else:
            raise RuntimeError('First unclassified child failure preserved; investigate before a fresh cohort')
(OUT/'complete.json').write_text(json.dumps(dict(children=len(schedule),failures=failures,inputsUnchanged=inventory()==inputs),indent=2)+'\n')
