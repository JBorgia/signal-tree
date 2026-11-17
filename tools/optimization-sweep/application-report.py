#!/usr/bin/env python3
"""Render an identified completed application summary; never runs workloads."""
from pathlib import Path
import hashlib
import json
import re
import sys


summary_path, driver_path, output_path = map(Path, sys.argv[1:])
summary = json.loads(summary_path.read_text())
driver = json.loads(driver_path.read_text())
assert driver['passed'] is True and len(driver['steps']) == 9
assert all(step['exitCode'] == 0 for step in driver['steps'])
head = driver['candidateHead']
assert re.fullmatch(r'[0-9a-f]{40}', head)
assert len(summary['groups']) == len(summary['pairs']) == 32
assert len(summary['sameArm']) == 4
assert not output_path.exists(), 'Preserve previous reports'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
arms = [
    ('native', 'Native Angular'), ('ngrx', 'NgRx'),
    ('v15-before', 'v15 before'), ('v15', 'v15 candidate'),
    ('v16-before', 'v16 C1'), ('v16', 'v16 candidate'),
    ('tanstack', 'TanStack'), ('tanstack-variant', 'TanStack alternative'),
]
groups = {(group['rows'], group['kind'], group['arm']): group['metrics']
          for group in summary['groups']}
assert len(groups) == 32


def number(value, places=1):
    return 'missing' if value is None else f'{value:.{places}f}'


def median(rows, kind, arm, metric, divisor=1, places=1):
    value = groups[rows, kind, arm][metric]
    assert value['n'] == 5 and value['missing'] == 0
    return number(value['median'] / divisor, places)


lines = [
    '# Application comparison: expanded metrics', '',
    f'Final v16 source: `{head}`. The v15 candidate is `4d1142d61`.',
    'These are the completed eight-implementation application results. Each normal',
    'arm/size/kind has five fresh-browser samples, with rotated order. The 176',
    'comparison children include separate v15 same-build controls. CPU-facing',
    'timing and forced-GC heap cohorts remain separate. All 88 behavior controls,',
    '32 context controls, 9 metric controls, 16 calibration children and 12',
    'analysis-admission controls complete. The exact artifacts and limits are',
    'described in [the report](README.md).', '',
    'Times below are medians of per-child observations. Per-child p95s are',
    'summarized across children, never pooled. Factory excludes seed generation.',
    'Full contexts include serialization. Staging/settlement include asynchronous',
    'fixture and service work. Throughput covers the entire checked 180-command',
    'trace, not an isolated kernel update. User-to-layout is queued-input latency,',
    'not INP. Heap is whole-application state, including framework and service',
    'objects; after explicit destruction the application/service fixture remains.',
    'It is not library-exclusive retained bytes or proof of a universal leak bound.', '',
]
for rows in [1000, 10000]:
    lines += [f'## {rows:,} rows', '',
              '| Implementation | Factory ms | First full context ms | Repeated full context p50 ms | User-to-layout p95 ms |',
              '| --- | ---: | ---: | ---: | ---: |']
    for arm, label in arms:
        values = [median(rows, 'timing', arm, key) for key in [
            'startup.factory', 'context.full.first.totalMs',
            'context.full.repeated.p50.totalMs', 'interleaved.user.p95.enqueueToLayoutMs']]
        lines.append('| ' + ' | '.join([label, *values]) + ' |')
    lines += ['', '| Implementation | Stage 128 proposals ms | Settle 128 proposals ms | Checked commands/second |',
              '| --- | ---: | ---: | ---: |']
    for arm, label in arms:
        values = [median(rows, 'timing', arm, key) for key in [
            'pressure.128.staged.elapsed', 'pressure.128.settled.elapsed',
            'interleaved.checkedCommandsPerSecond']]
        lines.append('| ' + ' | '.join([label, *values]) + ' |')
    lines += ['', 'Heap uses decimal MB. Pending and settled columns are increments over',
              'their immediately preceding populated checkpoint.', '',
              '| Implementation | Populated above blank MB | Pending 128 increment MB | Settled 128 increment MB | Destroyed above blank MB |',
              '| --- | ---: | ---: | ---: | ---: |']
    for arm, label in arms:
        values = [median(rows, 'memory', arm, key, 1_000_000, 3) for key in [
            'heap.populatedAboveBlank', 'heap.pending128AbovePopulated',
            'heap.settled128AbovePopulated', 'heap.destroyedAboveBlank']]
        lines.append('| ' + ' | '.join([label, *values]) + ' |')
    lines.append('')

lines += ['## Matched before/after changes', '',
          'These are medians of matched differences and their observed ranges.',
          'They need not equal differences between the group medians above.',
          'Positive latency or heap means more cost; positive throughput means more',
          'checked work per second. Five pairs are descriptive, not confidence intervals.', '',
          '| Line | Rows | Metric | Unit | Paired median change | Observed range |',
          '| --- | ---: | --- | --- | ---: | --- |']
selected = {
    'startup.factory': 'Factory',
    'context.full.repeated.p50.totalMs': 'Repeated full context p50',
    'pressure.128.staged.elapsed': 'Stage 128',
    'pressure.128.settled.elapsed': 'Settle 128',
    'interleaved.user.p95.enqueueToLayoutMs': 'User-to-layout p95',
    'interleaved.checkedCommandsPerSecond': 'Trace throughput',
    'heap.populatedAboveBlank': 'Populated above blank',
    'heap.pending128AbovePopulated': 'Pending 128 increment',
    'heap.settled128AbovePopulated': 'Settled 128 increment',
    'heap.destroyedAboveBlank': 'Destroyed above blank',
}
for pair in summary['pairs']:
    line = pair['numerator']
    if line not in ['v15', 'v16'] or pair['denominator'] != line + '-before':
        continue
    for key, label in selected.items():
        if key not in pair['metrics'] or (key.startswith('heap.') != (pair['kind'] == 'memory')):
            continue
        value = pair['metrics'][key]
        delta = value['difference']
        assert delta['n'] == 5 and delta['missing'] == 0
        places = 0 if value['unit'] == 'bytes' else 1
        values = [line, str(pair['rows']), label, value['unit'],
                  number(delta['median'], places),
                  number(delta['min'], places) + ' to ' + number(delta['max'], places)]
        lines.append('| ' + ' | '.join(values) + ' |')

lines += ['', '## Identity and replay', '',
          'The fixed workload runs through `run-t-application-final.py` in the',
          'frozen final-followthrough source1 packet. The numerical generator is',
          '`tools/optimization-sweep/application/analyze.mjs`. This table renderer is:', '',
          '```sh',
          'python3 tools/optimization-sweep/application-report.py SUMMARY_JSON DRIVER_RESULTS_JSON NEW_OUTPUT_MD',
          '```', '',
          f'- Summary SHA-256: `{sha(summary_path)}`.',
          f'- Completed driver SHA-256: `{sha(driver_path)}`.',
          f'- Qualified package seal SHA-256: `{driver["qualificationSealSha256"]}`.', '',
          'The evidence archive preserves the complete commands, exact package',
          'membership, child metrics, A/A observations and independent recomputation.',
          'The report retains host contention and implementation-scope limitations.', '']
output_path.write_text('\n'.join(lines))
print(json.dumps({'output': str(output_path.resolve()), 'sha256': sha(output_path),
                  'summarySha256': sha(summary_path), 'candidateHead': head}))
