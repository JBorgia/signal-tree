#!/usr/bin/env python3
"""Refresh the registered eight-arm cohort; never modifies runtime or old evidence.

Plan only after a selected five-package v15 artifact set is handed off. Execute
only while holding the team's exclusive build/browser measurement slot.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
CHECKOUT = HERE.parents[1]
REPOSITORY = Path('/Users/jonathanborgia/code/signaltree')
EVIDENCE = REPOSITORY / 'artifacts/oversight-peer-refresh-2026-11-17'
PRIOR = REPOSITORY / 'artifacts/optimization-sweep-2026-11-17'
V16 = REPOSITORY / 'artifacts/publication-activation-2026-11-17/v16-final-packages'
TOOLS = CHECKOUT / 'tools/optimization-sweep'
NODE = Path('/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node')
PHASES = ['prepare', 'build', 'conformance', 'context-controls', 'metric-controls',
          'calibration', 'comparison', 'analysis', 'admission-controls']
PACKAGES = ['kernel', 'angular', 'react', 'vue', 'solid']


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def now():
    return datetime.now(timezone.utc).isoformat()


def save_new(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def within_output(path):
    path = Path(path).resolve()
    assert path.is_relative_to(EVIDENCE) and path != EVIDENCE
    return path


def verify(bindings):
    for path, expected in bindings.items():
        assert sha(path) == expected, f'Bound input drift: {path}'


def package_identity(directory, bindings):
    selected = {}
    for name in PACKAGES:
        path = directory / f'{name}.json'
        manifest = read(path)
        bindings[str(path)] = sha(path)
        root = Path(manifest['root'])
        actual = {str(file.relative_to(root)): sha(file)
                  for file in root.rglob('*') if file.is_file()}
        assert actual == manifest['files'], f'Complete {name} payload inventory'
        receipt_path = Path(manifest['buildReceipt'])
        assert sha(receipt_path) == manifest['buildReceiptSha256']
        receipt = read(receipt_path)
        assert receipt['exitCode'] == 0 and receipt['sourceUnchanged'] is True
        assert manifest['head'] == receipt['head']
        assert manifest['sourceSeal'] == receipt['sourceSeal']
        bindings[str(receipt_path)] = sha(receipt_path)
        for relative, expected in actual.items():
            bindings[str(root / relative)] = expected
        for file, expected in receipt.get('snapshots', {}).items():
            assert sha(file) == expected
            bindings[file] = expected
        selected[name] = {'manifest': str(path), 'manifestSha256': sha(path),
                          'head': manifest['head'], 'sourceSeal': manifest['sourceSeal'],
                          'buildReceipt': str(receipt_path),
                          'buildReceiptSha256': sha(receipt_path)}
    assert len({value['head'] for value in selected.values()}) == 1
    assert len({value['sourceSeal'] for value in selected.values()}) == 1
    return selected


def plan(v15, output):
    output = within_output(output)
    assert not output.exists(), 'Preserve previous attempts'
    output.mkdir(parents=True)
    bindings = {str(Path(__file__).resolve()): sha(__file__)}
    bindings[str(HERE / 'render.py')] = sha(HERE / 'render.py')
    config_path = PRIOR / 't-application-final-run-1/config.json'
    prior_driver_path = PRIOR / 't-application-final-run-1/driver-results.json'
    prior_driver = read(prior_driver_path)
    assert prior_driver['passed'] is True and len(prior_driver['steps']) == 9
    assert all(step['exitCode'] == 0 for step in prior_driver['steps'])
    previous_config = read(config_path)
    earlier = read(PRIOR / 'application-final-config.json')
    assert {k: v for k, v in previous_config.items() if k != 'packages'} == {
        k: v for k, v in earlier.items() if k != 'packages'}
    method_path = Path(prior_driver['method']['path'])
    assert sha(method_path) == prior_driver['method']['sha256']
    method = read(method_path)
    for path, binding in method['bindings'].items():
        assert sha(path) == sha(binding['snapshot']) == binding['sha256'], path
        bindings[path] = binding['sha256']
    for path in [config_path, prior_driver_path, method_path,
                 TOOLS / 'application-report.py',
                 CHECKOUT / 'docs/performance/measurement-contract.md']:
        bindings[str(path)] = sha(path)
    identities = {'v15': package_identity(Path(v15).resolve(), bindings),
                  'v16': package_identity(V16, bindings)}
    config = copy.deepcopy(previous_config)
    for line in ['v15', 'v16']:
        config['packages'][line] = {
            name: {key: identities[line][name][key]
                   for key in ['manifest', 'manifestSha256']}
            for name in ['kernel', 'angular']}
    assert config['baselinePacket'] == previous_config['baselinePacket']
    assert sha(NODE) == config['execution']['node']['sha256']
    save_new(output / 'config.json', config)
    bindings[str(output / 'config.json')] = sha(output / 'config.json')
    save_new(output / 'package-identities.json', identities)
    bindings[str(output / 'package-identities.json')] = sha(output / 'package-identities.json')
    value = {
        'kind': 'oversight-peer-refresh-v1', 'createdUTC': now(),
        'command': [sys.executable, *sys.argv], 'checkout': str(CHECKOUT),
        'output': str(output), 'node': str(NODE), 'bindings': bindings,
        'priorDriver': str(prior_driver_path), 'priorDriverSha256': sha(prior_driver_path),
        'identities': identities, 'phases': PHASES,
        'counts': prior_driver['counts'],
        'beforeArms': 'Frozen original 2026-11-16 application packet; freshly measured again.',
        'strategy': 'Same registered asMap/peer bulk-context strategies; only after-arm package identities change.',
        'limits': [
            'Fresh local Angular application evidence, not release qualification or deployment.',
            'Before/after pairs measure cumulative changes against the original baseline.',
            'Prior pre-activation v16 results remain historical and are not relabelled.',
            'Common application coordination is not the full native v16 guarantee workflow.',
            'Five paired rounds and v15 A/A bands are descriptive, not confidence intervals.',
            'Whole application heap includes framework and command-service state.'
        ]
    }
    verify(bindings)
    save_new(output / 'plan.json', value)
    print(json.dumps({'planned': str(output), 'status': 'Not built or measured'}))


def commands(output):
    packet = output / 'packet'
    return {
        'prepare': [NODE, TOOLS / 'application-prepare.mjs', output / 'config.json', packet],
        'build': [NODE, CHECKOUT / 'tools/application-lab/lab.mjs', 'build-dispatch', packet],
        'conformance': [NODE, CHECKOUT / 'tools/application-lab/dispatch-check.mjs', packet],
        'context-controls': [NODE, TOOLS / 'application/context-controls.mjs', packet, packet / 'optimization-context-controls'],
        'metric-controls': [NODE, TOOLS / 'application/measure.mjs', 'controls', packet, output / 'metric-controls'],
        'calibration': [NODE, TOOLS / 'application/measure.mjs', 'calibrate', packet, output / 'calibration'],
        'comparison': [NODE, TOOLS / 'application/measure.mjs', 'compare', packet, output / 'comparison', output / 'metric-controls/results.json', output / 'calibration/results.json'],
        'analysis': [NODE, TOOLS / 'application/analyze.mjs', output / 'comparison', output / 'analysis'],
        'admission-controls': [NODE, TOOLS / 'application/analyzer-controls.mjs', output / 'comparison', output / 'admission-controls'],
    }


def execute(output, phase):
    output = within_output(output)
    registered = read(output / 'plan.json')
    assert registered['output'] == str(output)
    env = dict(os.environ)
    env.pop('NODE_OPTIONS', None)
    env.pop('ST_HISTORICAL_INPUTS_CONFIG', None)
    env.update(NX_DAEMON='false', NX_ISOLATE_PLUGINS='false', CI='true', NG_BUILD_MAX_WORKERS='1')
    env['PATH'] = str(NODE.parent) + os.pathsep + env['PATH']
    for name in PHASES if phase == 'all' else [phase]:
        index = PHASES.index(name)
        for prerequisite in PHASES[:index]:
            assert read(output / 'commands' / prerequisite / 'receipt.json')['exitCode'] == 0
        verify(registered['bindings'])
        directory = output / 'commands' / name
        directory.mkdir(parents=True)
        args = list(map(str, commands(output)[name]))
        record = {'name': name, 'command': args, 'cwd': str(CHECKOUT),
                  'startedUTC': now(), 'planSha256': sha(output / 'plan.json'),
                  'environment': {key: env[key] for key in ['NX_DAEMON', 'NX_ISOLATE_PLUGINS', 'CI', 'NG_BUILD_MAX_WORKERS']},
                  'hostLoadBefore': os.getloadavg()}
        save_new(directory / 'plan.json', record)
        started = time.monotonic()
        with (directory / 'command.log').open('xb') as log:
            result = subprocess.run(args, cwd=CHECKOUT, env=env, stdout=log, stderr=subprocess.STDOUT)
        record.update(exitCode=result.returncode, seconds=time.monotonic() - started,
                      finishedUTC=now(), logSha256=sha(directory / 'command.log'),
                      hostLoadAfter=os.getloadavg())
        save_new(directory / 'receipt.json', record)
        print(json.dumps({key: record[key] for key in ['name', 'exitCode', 'seconds']}), flush=True)
        assert result.returncode == 0, f'First failure preserved: {directory}'
        verify(registered['bindings'])
    if all((output / 'commands' / p / 'receipt.json').exists() for p in PHASES):
        steps = [read(output / 'commands' / p / 'receipt.json') for p in PHASES]
        assert all(step['exitCode'] == 0 for step in steps)
        save_new(output / 'driver-results.json', {
            'passed': True, 'candidateHead': registered['identities']['v16']['kernel']['head'],
            'v15Head': registered['identities']['v15']['kernel']['head'],
            'steps': steps, 'planSha256': sha(output / 'plan.json'),
            'qualificationSealSha256': sha(output / 'package-identities.json'),
            'sealScope': 'Selected built package identities; not a release-qualification claim.',
            'finishedUTC': now()
        })


parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest='action', required=True)
planning = sub.add_parser('plan')
planning.add_argument('v15_packages')
planning.add_argument('new_output')
running = sub.add_parser('run')
running.add_argument('output')
running.add_argument('phase', choices=[*PHASES, 'all'])
args = parser.parse_args()
if args.action == 'plan':
    plan(args.v15_packages, args.new_output)
else:
    execute(args.output, args.phase)
