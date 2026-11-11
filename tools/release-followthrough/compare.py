#!/usr/bin/env python3
"""Serial, bound-input aging replay and ordinary three-arm comparison."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
packet = Path(sys.argv[1]).resolve()
mode = sys.argv[2]
assert mode in ('aging', 'ordinary')
out = packet / (mode + '-runs')
out.mkdir(exist_ok=False)
node = shutil.which('node')
arms = ['packed', 'v16'] if mode == 'aging' else ['v15', 'v15-repaired', 'v16']
profiles = ['wide-8', 'wide-32', 'steady', 'promote'] if mode == 'aging' else ['jobs', 'products', 'heap']
schedule = []
for profile in profiles:
    schedule += [{'profile': profile, 'arm': arms[0], 'role': 'aa'} for _ in range(2)]
    orders = [[0, 1], [1, 0], [0, 1]] if mode == 'aging' else [[0, 1, 2], [2, 1, 0], [1, 2, 0], [0, 2, 1], [1, 0, 2]]
    for order in orders:
        schedule += [{'profile': profile, 'arm': arms[i], 'role': 'comparison'} for i in order]

def hashes():
    names = ['tools/release-followthrough/compare.py', 'tools/release-followthrough/policy.json',
             'tools/release-followthrough/' + ('aging-child.mjs' if mode == 'aging' else 'ordinary-child.mjs'),
             'tools/lib/heap-quiescence.mjs']
    if mode == 'ordinary':
        names += ['tools/release-economics/ordinary.mjs', 'tools/release-economics/policy.json',
                  'apps/react-reference/src/app/reference-store.ts',
                  'apps/demo/src/app/examples/features/fundamentals/examples/entities/entities-demo.component.ts']
    paths = [root / name for name in names]
    for arm in arms:
        directory = packet / (arm + '-kernel')
        assert (directory / 'dist/index.js').is_file(), directory
        paths += [p for p in directory.rglob('*') if p.is_file()]
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}

identity = hashes()
plan = {'createdUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'inputs': identity,
        'schedule': schedule, 'node': subprocess.check_output([node, '--version'], text=True).strip(),
        'host': subprocess.check_output([node, '-p', "require('os').cpus()[0].model"], text=True).strip(),
        'policy': json.loads((root / 'tools/release-followthrough/policy.json').read_text())}
(out / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
observations = {}
failures = []
for i, item in enumerate(schedule):
    assert hashes() == identity, 'input drift before child'
    output = out / f'{i:03}.json'
    if mode == 'aging':
        command = [node, '--expose-gc', '--max-old-space-size=768', str(root / 'tools/release-followthrough/aging-child.mjs'),
                   str(packet / (item['arm'] + '-kernel/dist')), item['profile'], str(output)]
    else:
        workload = ['heap', 'jobs', '1000'] if item['profile'] == 'heap' else ['cpu', item['profile'], '1000']
        command = [node, '--expose-gc', '--max-old-space-size=768', str(root / 'tools/release-followthrough/ordinary-child.mjs'),
                   str(root), str(packet), item['arm'], *workload]
    start = time.time()
    load = os.getloadavg()
    stdout_path = out / f'{i:03}.log' if mode == 'aging' else output
    with stdout_path.open('w') as stdout, (out / f'{i:03}.err').open('w') as stderr:
        result = subprocess.run(command, stdout=stdout, stderr=stderr, timeout=180, env={**os.environ, 'NODE_ENV': 'production'})
    receipt = {**item, 'index': i, 'command': command, 'exit': result.returncode, 'seconds': time.time() - start,
               'loadBefore': load, 'loadAfter': os.getloadavg()}
    (out / f'{i:03}.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)
    sample = json.loads(output.read_text())
    if result.returncode:
        failures.append(receipt)
        assert mode == 'ordinary' and item['arm'] == 'v15' and sample.get('checks', {}).get('actualResourcesCollected') is False, 'unclassified or repaired-arm failure'
    if mode == 'aging':
        assert sample['weakAlive'] == 0 and sample['profile'] == item['profile']
        base = sample['heap']['baseline']['heapUsed']
        metrics = {'heap.' + k: v['heapUsed'] - base for k, v in sample['heap'].items() if k != 'baseline'}
        metrics.update({phase + '.' + k: values[k] for phase, values in sample['metrics'].items() for k in ['syncCpu', 'totalCpu', 'syncWall']})
    else:
        metrics = dict(sample['endpoints'])
        if 'cold' in sample:
            metrics.update({'coldSyncCpuMs': sample['cold']['syncCpuMs'], 'coldTotalCpuMs': sample['cold']['totalCpuMs']})
    observations.setdefault(item['profile'], {}).setdefault('aa' if item['role'] == 'aa' else item['arm'], []).append(metrics)
    assert hashes() == identity, 'input drift after child'

summary = {}
for profile, grouped in observations.items():
    summary[profile] = {}
    for metric in grouped['aa'][0]:
        samples = {arm: [row[metric] for row in values] for arm, values in grouped.items()}
        comparisons = {}
        for left_index, left in enumerate(arms):
            for right in arms[left_index + 1:]:
                a, b, aa = samples[left], samples[right], samples['aa']
                gap = statistics.median(b) - statistics.median(a)
                spread = max(max(values) - min(values) for values in [a, b, aa])
                direction = 'unresolved'
                if abs(gap) > spread:
                    if max(b) < min(a): direction = 'lower'
                    elif max(a) < min(b): direction = 'higher'
                comparisons[left + ' -> ' + right] = {'delta': gap, 'direction': direction}
        summary[profile][metric] = {'samples': samples, 'medians': {arm: statistics.median(values) for arm, values in samples.items()}, 'comparisons': comparisons}
(out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
(out / 'complete.json').write_text(json.dumps({'children': len(schedule), 'baselineFailures': len(failures), 'inputsUnchanged': True}, indent=2) + '\n')
