#!/usr/bin/env python3
"""Summarize all planned comparison children; retain raw distributions."""
import json
from pathlib import Path
import statistics
import sys

folder=Path(sys.argv[1])
plan=json.loads((folder/'plan.json').read_text())
complete=json.loads((folder/'complete.json').read_text())
assert complete['children']==len(plan['schedule']) and complete['inputsUnchanged']
groups={}
for i,entry in enumerate(plan['schedule']):
    receipt=json.loads((folder/f'{i:03}.receipt.json').read_text())
    result=json.loads((folder/f'{i:03}.out.json').read_text())
    assert receipt['exit']==0 or (receipt['exit']==1 and result.get('checks',{}).get('actualResourcesCollected') is False)
    key='/'.join(entry['profile'])
    groups.setdefault(key,[]).append((entry,result))

limits=plan['policy']['budgets']
def budget(name):
    if name in ['coldInitWallMs','initP95WallMs']: return limits['initializationWallMs']
    if name in ['interactionP95WallMs','stageP95WallMs']: return limits['interactionWallMs']
    if name=='workflowP95WallMs': return limits['coordinatedWorkflowWallMs']
    if name in ['populatedBytes','editedBytes','pendingBytes','settledBytes']: return limits['liveStateBytes']
    return None

summary={'phase':plan['phase'],'complete':complete,'groups':{}}
summary['packedLifecycleFailures']=[f for f in complete.get('failures',[]) if plan['schedule'][f['index']]['arm']=='packed']
summary['referenceLifecycleFailures']=[f for f in complete.get('failures',[]) if plan['schedule'][f['index']]['arm']!='packed']
for key,results in groups.items():
    rows={}
    names=results[0][1]['endpoints'].keys()
    for name in names:
        arms={}
        for role in ['aa','comparison']:
            for arm in sorted({entry['arm'] for entry,_ in results if entry['role']==role}):
                samples=[result['endpoints'][name] for entry,result in results if entry['role']==role and entry['arm']==arm]
                arms[f'{role}-{arm}']={'samples':samples,'median':statistics.median(samples),'min':min(samples),'max':max(samples)}
        cap=budget(name)
        packed=arms['comparison-packed']
        crossed=sum(value>cap for value in packed['samples']) if cap is not None else None
        status=('pass' if crossed==0 else 'fail' if crossed>=4 else 'mixed-no-go') if cap is not None else 'descriptive'
        ref=next(value for arm,value in arms.items() if arm.startswith('comparison-') and arm!='comparison-packed')
        widths=[a['max']-a['min'] for a in arms.values()]
        diff=packed['median']-ref['median']
        separated=packed['max']<ref['min'] or packed['min']>ref['max']
        direction=('higher' if diff>0 else 'lower') if separated and abs(diff)>max(widths) else 'unresolved'
        rows[name]={'arms':arms,'limit':cap,'packedCrossings':crossed,'status':status,'relative':direction,'packedToReferenceRatio':packed['median']/ref['median'] if ref['median'] else None}
    summary['groups'][key]=rows
summary['decision']='NO-GO' if summary['packedLifecycleFailures'] or any(row['status'] in ['fail','mixed-no-go'] for rows in summary['groups'].values() for row in rows.values()) else 'economics-pass-only'
(folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for profile, rows in summary['groups'].items():
    print(profile)
    for name,row in rows.items():
        medians={arm:round(a['median'],4) for arm,a in row['arms'].items()}
        print(f"  {name}: {medians}; cap={row['limit']}; {row['status']} ({row['packedCrossings']}/5); relative={row['relative']}")
print(summary['decision'])
