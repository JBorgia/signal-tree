"""Exercise completed-run joins and real canonical admission without mutations.

Usage: admission-controls.py QUALIFICATION_ROOT NEW_OUTPUT
Application fixtures are synthetic schema controls, not performance observations.
"""
import copy
import json
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch
import admission as a

qualification, out = map(lambda p: Path(p).resolve(), sys.argv[1:])
assert not out.exists()
out.mkdir(parents=True)
checks = []


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def rejects(name, function):
    try:
        function()
    except AssertionError as error:
        checks.append({'name': name, 'rejected': True, 'error': str(error)})
    else:
        raise AssertionError('Accepted planted defect: ' + name)


def fake_read(path, target, mutation):
    value = original_read(path)
    if Path(path) == target:
        mutation(value)
    return value


original_read = a.read
positive = a.canonical_packages(qualification, 'v15')
base = qualification / 'v15-final-artifact-checks'
canonical_cases = [
    ('completion head mismatch', base / 'result.json', lambda x: x.update(head='0' * 40)),
    ('stale canonical identity', base / 'packed-payloads.json', lambda x: x.update(head='0' * 40)),
    ('incomplete journal', base / 'canonical-candidate/candidate.json', lambda x: x['packages'].pop()),
    ('missing canonical payloads', base / 'packed-payloads.json', lambda x: x['payloads'].pop('solid')),
    ('missing source snapshots', Path(original_read(qualification / 'v15-final-packages/kernel.json')['buildReceipt']), lambda x: x.update(snapshots={})),
]
for label, target, mutate in canonical_cases:
    with patch.object(a, 'read', side_effect=lambda p, t=target, m=mutate: fake_read(p, t, m)):
        rejects(label, lambda: a.canonical_packages(qualification, 'v15'))

with tempfile.TemporaryDirectory(prefix='startup-admission-') as temporary:
    run = Path(temporary).resolve()
    marker = run / 'input.txt'; marker.write_text('one preserved input\n')
    identities = {line: {name: {'head': line + '-selected', 'sourceSeal': line + '-seal', 'buildReceiptSha256': line + '-receipt'}
                         for name in ['kernel', 'angular']} for line in ['v15', 'v16']}
    current = {line: line + '-before' for line in ['v15', 'v16']}
    plan = {'kind': 'startup-economics-application-v1', 'output': str(run), 'counts': a.COUNTS,
            'identities': identities, 'currentHeads': current, 'phases': a.PHASES,
            'bindings': {str(marker): a.sha(marker)}}
    write(run / 'plan.json', plan)
    steps = []
    for name in a.PHASES:
        log = run / 'commands' / name / 'command.log'; log.parent.mkdir(parents=True); log.write_text(name + '\n')
        record = {'name': name, 'exitCode': 0, 'planSha256': a.sha(run / 'plan.json'), 'logSha256': a.sha(log)}
        write(log.parent / 'receipt.json', record); steps.append(record)
    result = {'passed': True, 'planSha256': a.sha(run / 'plan.json'), 'counts': a.COUNTS,
              'identities': identities, 'steps': steps}
    write(run / 'driver-results.json', result)
    artifacts = {}
    for line in ['v15', 'v16']:
        for name in ['kernel', 'angular']:
            artifacts[f'{line}-{name}'] = {'sourceIdentity': identities[line][name]}
            artifacts[f'{line}-before-{name}'] = {'sourceIdentity': {'head': current[line]}}
    packet = {'arms': a.ARMS, 'startupEconomics': {'currentHeads': current},
              'artifacts': artifacts, 'inputs': {str(marker): a.sha(marker)}}
    write(run / 'packet/plan.json', packet)
    build = {'planSha256': a.sha(run / 'packet/plan.json'),
             'arms': {arm: {'dependencies': {}, 'served': {str(marker): a.sha(marker)}} for arm in a.ARMS}}
    write(run / 'packet/dispatch-build.json', build)
    write(run / 'comparison/results.json', {'mode': 'compare', 'passed': True,
          'planned': 288, 'completed': 288, 'children': [{} for _ in range(288)]})
    write(run / 'comparison/schedule.json', {'synthetic': True})
    summary = {'source': {}, 'bindings': {str(marker): a.sha(marker)}}
    for relative in ['comparison/results.json', 'comparison/schedule.json']:
        summary['bindings'][str(run / relative)] = a.sha(run / relative)
    for key, filename in [('plan', 'plan.json'), ('build', 'dispatch-build.json')]:
        p = run / 'packet' / filename
        summary['source'].update({key + 'Path': str(p), key + 'Sha256': a.sha(p)})
    write(run / 'analysis/summary.json', summary)
    for step in steps:
        for relative in a.OUTPUTS[step['name']]:
            if not (run / relative).exists():
                write(run / relative, {'synthetic': True})
        step['outputs'] = {str(run / relative): a.sha(run / relative) for relative in a.OUTPUTS[step['name']]}
        write(run / 'commands' / step['name'] / 'receipt.json', step)
    write(run / 'driver-results.json', result)
    admitted = a.completed_application(run)
    cases = [
        ('wrong driver plan', run / 'driver-results.json', lambda x: x.update(planSha256='0' * 64)),
        ('wrong driver identity', run / 'driver-results.json', lambda x: x['identities']['v15']['kernel'].update(head='wrong')),
        ('omitted phase', run / 'driver-results.json', lambda x: x['steps'].pop()),
        ('stale phase receipt', run / 'commands/build/receipt.json', lambda x: x.update(logSha256='0' * 64)),
        ('wrong selected packet', run / 'packet/plan.json', lambda x: x['artifacts']['v16-kernel']['sourceIdentity'].update(head='wrong')),
        ('wrong analysis build', run / 'analysis/summary.json', lambda x: x['source'].update(buildSha256='0' * 64)),
        ('wrong comparison output binding', run / 'analysis/summary.json', lambda x: x['bindings'].pop(str(run / 'comparison/results.json'))),
    ]
    for label, target, mutate in cases:
        with patch.object(a, 'read', side_effect=lambda p, t=target, m=mutate: fake_read(p, t, m)):
            rejects(label, lambda: a.completed_application(run))
    marker.write_text('changed preserved input\n')
    rejects('changed frozen input', lambda: a.completed_application(run))
    marker.write_text('one preserved input\n')
    (run / 'analysis/summary.json').write_text(json.dumps({**summary, 'changedMedian': 123}) + '\n')
    rejects('changed sealed analysis output', lambda: a.completed_application(run))

write(out / 'results.json', {
    'passed': True, 'realCanonicalPositive': {key: value for key, value in positive.items() if key != 'bindings'},
    'realCanonicalVerifiedBindings': len(positive['bindings']),
    'syntheticApplicationPositive': True, 'controls': checks,
    'bindings': {str(path): a.sha(path) for path in [Path(__file__), Path(a.__file__), base / 'result.json', base / 'packed-payloads.json']},
    'limits': 'Read-only admission and synthetic metadata defects. No runtime mutation, performance sample or real completed application cohort is supplied by these controls.'})
print(json.dumps({'passed': True, 'controls': len(checks)}))
