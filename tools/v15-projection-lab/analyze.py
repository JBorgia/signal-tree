#!/usr/bin/env python3
"""Describe one complete registered projection cohort, preserving every arm sample."""
import hashlib
import json
import pathlib
import statistics
import sys

root = pathlib.Path(sys.argv[1]).resolve()
source = root / 'results.json'
results = json.loads(source.read_text())
schedule = json.loads((root / 'schedule.json').read_text())
bindings = json.loads((root / 'bindings.json').read_text())
profiles = list(dict.fromkeys(row['profile'] for row in schedule))
assert profiles in [['projection', 'inventory', 'point'], ['projection', 'inventory', 'point', 'projection-and-ids']]
assert len(results) == len(schedule) == len(profiles) * 28
assert len({row['pid'] for row in results}) == len(schedule)
for actual, planned in zip(results, schedule):
    assert all(actual[key] == value for key, value in planned.items())
    assert actual['passed']
    assert actual['artifact'] == bindings['artifacts'][actual['arm']]['sha256']
    receipt = json.loads((root / f"child-{actual['id']:03d}.json").read_text())
    assert receipt['status'] == 0
    raw = json.loads(receipt['stdout'])
    assert all(actual[key] == value for key, value in raw.items())

def summary(values):
    return {'median': statistics.median(values), 'minimum': min(values),
            'maximum': max(values), 'samples': values}

def metric(row, endpoint, stage):
    if stage is None:
        if endpoint == 'setupWallMs':
            return row['setup']['wallMs']
        if endpoint == 'setupCpuUs':
            return sum(row['setup']['cpu'].values())
        if endpoint == 'populatedHeapBytes':
            return row['populatedHeap'] - row['importedHeap']
        if endpoint == 'destroyedHeapBytes':
            return row['destroyedHeap'] - row['importedHeap']
    phase = row['stages'][stage]
    if endpoint == 'cumulativeCpuUs':
        return phase['cumulativeCpuUs']
    if endpoint == 'cumulativeWallMs':
        return phase['cumulativeWallMs']
    if endpoint == 'segmentCpuUs':
        return sum(phase['cpu'].values())
    if endpoint == 'segmentWallMs':
        return phase['wallMs']
    if endpoint == 'liveHeapBytes':
        return phase['heap'] - row['importedHeap']
    raise AssertionError(endpoint)

output = []
for count in [1000, 10000]:
    for profile in profiles:
        cell = [row for row in results if row['count'] == count and row['profile'] == profile]
        for stage, endpoints in [(None, ['setupWallMs', 'setupCpuUs', 'populatedHeapBytes', 'destroyedHeapBytes'])] + [
            (i, ['cumulativeCpuUs', 'cumulativeWallMs', 'segmentCpuUs', 'segmentWallMs', 'liveHeapBytes']) for i in range(3)
        ]:
            for endpoint in endpoints:
                arms = {arm: [metric(row, endpoint, stage) for row in cell if not row['control'] and row['arm'] == arm]
                        for arm in ['frozen', 'variant']}
                assert all(len(values) == 5 for values in arms.values())
                control_gaps = []
                for pair in [0, 1]:
                    values = [metric(row, endpoint, stage) for row in cell if row['control'] and row['pair'] == pair]
                    assert len(values) == 2
                    control_gaps.append(abs(values[0] - values[1]))
                f, v = summary(arms['frozen']), summary(arms['variant'])
                band = max(*control_gaps, f['maximum'] - f['minimum'], v['maximum'] - v['minimum'])
                separated = f['minimum'] > v['maximum'] or v['minimum'] > f['maximum']
                resolved = separated and abs(f['median'] - v['median']) > band
                ratios = []
                for pair in range(2, 7):
                    paired = {row['arm']: metric(row, endpoint, stage) for row in cell if row['pair'] == pair}
                    ratios.append(paired['variant'] / paired['frozen'] if paired['frozen'] else None)
                output.append({'count': count, 'profile': profile, 'endpoint': endpoint,
                               'edits': None if stage is None else [100, 1000, 5000][stage],
                               'frozen': f, 'variant': v, 'controlGaps': control_gaps, 'observedBand': band,
                               'direction': ('lower' if v['median'] < f['median'] else 'higher') if resolved else 'unresolved',
                               'pairedRatios': ratios})

report = {'resultsSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'buildDefines': bindings.get('defines'),
          'limits': 'Local observed samples, not confidence intervals; whole-process heap; neutral kernel workload. Build definitions identify the diagnostic configuration separately.',
          'measurements': output}
(root / 'analysis.json').write_text(json.dumps(report, indent=2) + '\n')
for row in output:
    if row['endpoint'] == 'cumulativeCpuUs' and row['edits'] == 5000:
        print(row['count'], row['profile'], row['frozen']['median'], row['variant']['median'], row['direction'])
