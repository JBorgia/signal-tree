#!/usr/bin/env python3
"""Describe the fixed C1/dual/combined-tail capture cohort; no runtime execution."""
from pathlib import Path
import hashlib, json, statistics, sys

cpu_root, heap_root, output = map(lambda p: Path(p).resolve(), sys.argv[1:])
assert not output.exists()
bindings = {}
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):
    bindings[str(path)] = sha(path)
    return json.loads(path.read_text())
def stats(values):
    return {'values': values, 'median': statistics.median(values), 'min': min(values), 'max': max(values)}

summary = {'command': sys.argv, 'generator': str(Path(__file__).resolve()), 'generatorSha256': sha(Path(__file__)), 'cohorts': {}, 'limits': [
    'Tail denotes the entire final combined candidate, not an isolated N change.',
    'Three descriptive paired rounds and one baseline A/A pair per profile; no population significance claim.',
    'First, nineteen warm captures and all one hundred alternating operations are retained. CPU and heap use separate processes.',
    'Whole-process post-GC heap is not total allocation or a universal leak proof.'
]}
for kind, root in [('cpu', cpu_root), ('heap', heap_root)]:
    plan_path = root/'plan.json'; plan = read(plan_path); result = read(root/'results.json')
    assert result['planSha256'] == sha(plan_path) and plan['mode'] == kind
    assert len(plan['rows']) == len(result['children']) == 33 and len(plan['controls']) == 8
    for index, task in enumerate(plan['controls']):
        stem = f'control-{index:03d}'; receipt = read(root/(stem+'.json'))
        assert receipt['task'] == task and receipt['expectedOracleRejected'] is True
        assert receipt['status'] != 0 and not receipt.get('signal') and not receipt.get('error')
        for stream in ['stdout','stderr']:
            path=root/(stem+'.'+stream); assert sha(path)==receipt[stream+'Sha256'];bindings[str(path)]=sha(path)
    for index, child in enumerate(result['children']):
        stem=f'run-{index:03d}'; raw=read(root/(stem+'.json'));receipt=read(root/(stem+'.receipt.json'))
        assert raw == child and child['task'] == plan['rows'][index] == receipt['task']
        assert child['planSha256'] == sha(plan_path) and child['generatorSha256'] == plan['generatorSha256']
        assert receipt['status'] == 0 and not receipt.get('signal') and not receipt.get('error')
        for stream in ['stdout','stderr']:
            path=root/(stem+'.'+stream); assert sha(path)==receipt[stream+'Sha256'];bindings[str(path)]=sha(path)
        assert json.loads((root/(stem+'.stdout')).read_text())==child
    assert len({c['pid'] for c in result['children']})==33
    profiles=[]
    for profile in ['no-history','homogeneous','mixed']:
        rows=[c for c in result['children'] if c['task']['profile']==profile]
        def values(child):
            if kind=='heap':return child['heap']
            return {phase+'.'+unit:value for phase, measures in child['phases'].items() for unit,value in measures.items()}
        table={}
        for name in values(rows[0]):
            by_arm={arm:[values(next(c for c in rows if c['task']['group']=='comparison' and c['task']['pair']==pair and c['task']['arm']==arm))[name] for pair in range(3)] for arm in ['baseline','dual','tail']}
            aa=[values(next(c for c in rows if c['task']['group']=='AA' and c['task']['replicate']==i))[name] for i in range(2)]
            table[name]={'arms':{a:stats(v) for a,v in by_arm.items()},'pairedDifferences':{a+'-baseline':stats([x-y for x,y in zip(by_arm[a],by_arm['baseline'],strict=True)]) for a in ['dual','tail']},'baselineAA':{'values':aa,'difference':aa[1]-aa[0]}}
        profiles.append({'profile':profile,'metrics':table})
    summary['cohorts'][kind]={'normalChildren':33,'controls':8,'plan':str(plan_path),'planSha256':sha(plan_path),'armIdentities':{a:b['identity'] for a,b in plan['arms'].items()},'profiles':profiles}
summary['bindings']=bindings
with output.open('x') as stream:json.dump(summary,stream,indent=2);stream.write('\n')
print(output)
