#!/usr/bin/env python3
"""Preregistered serial comparison: qualified baseline versus lazy field prototype."""
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
assert mode in ('aging', 'demand')
out = packet / ('lazy-' + mode)
out.mkdir(exist_ok=False)
arms = ['qualified-v16', 'lazy-v16']
profiles = ['wide-8', 'wide-32', 'steady', 'promote'] if mode == 'aging' else ['wide-32']
schedule = []
for profile in profiles:
    schedule += [{'profile': profile, 'arm': arms[0], 'role': 'aa'} for _ in range(2)]
    for order in [[0, 1], [1, 0], [0, 1]]:
        schedule += [{'profile': profile, 'arm': arms[i], 'role': 'comparison'} for i in order]
node = shutil.which('node')
child = 'aging-child.mjs' if mode == 'aging' else 'field-demand-child.mjs'

def hashes():
    paths = [root / 'tools/release-followthrough' / name for name in ['compare-lazy.py', child]]
    paths += [root / 'tools/lib/heap-quiescence.mjs']
    for arm in arms:
        paths += [p for p in (packet / (arm + '-kernel')).rglob('*') if p.is_file()]
        assert (packet / (arm + '-kernel/dist/index.js')).is_file()
    return {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}

bindings = hashes()
plan = {'startedUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'mode': mode, 'schedule': schedule, 'inputs': bindings,
        'node': subprocess.check_output([node, '--version'], text=True).strip(),
        'host': subprocess.check_output([node, '-p', "require('os').cpus()[0].model"], text=True).strip(),
        'primary': 'Second-phase live heap for aging; demand progression separately identifies field creation cost. All-fields endpoint makes deferred costs explicit.',
        'direction': 'Disjoint arm ranges and median difference exceeding largest arm or A/A range. Descriptive single-host result; no confidence-interval claim.',
        'limits': 'Finite edit rounds, actual-resource sentinels and common behavior; no universal plateau or frame-time guarantee.',
        'failure': 'Stop on any child failure or changed input. No retries.'}
(out / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
observations = {}
for i, item in enumerate(schedule):
    assert hashes() == bindings
    output = out / f'{i:03}.json'
    command = [node, '--expose-gc', '--max-old-space-size=768', str(root / 'tools/release-followthrough' / child), str(packet / (item['arm'] + '-kernel/dist'))]
    if mode == 'aging': command += [item['profile']]
    command += [str(output)]
    start = time.time()
    load = os.getloadavg()
    with (out / f'{i:03}.log').open('w') as log:
        process = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, timeout=180, env={**os.environ, 'NODE_ENV': 'production'})
    receipt = {**item, 'command': command, 'startedUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(start)),
               'seconds': time.time() - start, 'exit': process.returncode, 'loadBefore': load, 'loadAfter': os.getloadavg()}
    (out / f'{i:03}.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)
    assert process.returncode == 0
    assert hashes() == bindings
    sample = json.loads(output.read_text())
    base = sample['heap']['baseline']['heapUsed']
    metrics = {'heap.' + k: v['heapUsed'] - base for k, v in sample['heap'].items() if k != 'baseline'}
    for phase, values in sample['metrics'].items():
        metrics.update({phase + '.' + key: value for key, value in values.items() if key != 'operations'})
    observations.setdefault(item['profile'], {}).setdefault('aa' if item['role'] == 'aa' else item['arm'], []).append(metrics)
summary = {}
for profile, grouped in observations.items():
    summary[profile] = {}
    for metric in grouped['aa'][0]:
        samples = {arm: [value[metric] for value in rows] for arm, rows in grouped.items()}
        a, b = samples[arms[0]], samples[arms[1]]
        gap = statistics.median(b) - statistics.median(a)
        spread = max(max(values) - min(values) for values in samples.values())
        direction = 'unresolved'
        if abs(gap) > spread:
            if max(b) < min(a): direction = 'lower'
            elif max(a) < min(b): direction = 'higher'
        summary[profile][metric] = {'samples': samples, 'medians': {arm: statistics.median(values) for arm, values in samples.items()}, 'delta': gap, 'direction': direction}
(out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
(out / 'complete.json').write_text(json.dumps({'children': len(schedule), 'inputsUnchanged': True}, indent=2) + '\n')
