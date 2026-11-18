"""Freeze and execute the three-tier current-to-successor application cohort.

Usage: run-application.py plan CONFIG NEW_OUTPUT
       run-application.py run OUTPUT PHASE|all
Execution requires the team's exclusive heavy-work slot.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from admission import completed_application, OUTPUTS

if not __debug__:
    raise RuntimeError('Integrity checks require normal Python execution')

HERE = Path(__file__).resolve().parent
CHECKOUT = HERE.parents[1]
ROOT = Path('/Users/jonathanborgia/code/signaltree')
EVIDENCE = ROOT / 'artifacts/startup-market-economics-2026-11-18'
NODE = Path('/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node')
PHASES = ['prepare', 'build', 'conformance', 'context-controls', 'metric-controls',
          'calibration', 'comparison', 'analysis', 'admission-controls']


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def now():
    return datetime.now(timezone.utc).isoformat()


def verify(bindings):
    for path, expected in bindings.items():
        assert sha(path) == expected, f'Bound input drift: {path}'


def within_output(path):
    path = Path(path).resolve()
    assert path.is_relative_to(EVIDENCE) and path != EVIDENCE
    return path


def plan(config_path, output):
    config_path = Path(config_path).resolve()
    output = within_output(output)
    assert not output.exists(), 'Preserve earlier attempts'
    config = read(config_path)
    assert config['kind'] == 'startup-economics-current-to-successor-v1'
    assert set(config['successorHeads']) == {'v15', 'v16'}
    bindings = {str(config_path): sha(config_path)}
    for path in [*HERE.glob('*.mjs'), Path(__file__).resolve(),
                 HERE / 'admission.py',
                 *HERE.joinpath('application').glob('*')]:
        if path.is_file():
            bindings[str(path)] = sha(path)
    baseline = Path(config['baselinePacket'])
    assert sha(baseline / 'plan.json') == config['baselinePlanSha256']
    assert sha(baseline / 'dispatch-build.json') == config['baselineBuildSha256']
    prior = read(baseline / 'plan.json')
    bindings.update(prior['inputs'])
    for name in ['plan.json', 'dispatch-build.json']:
        bindings[str(baseline / name)] = sha(baseline / name)
    identities = {}
    for line in ['v15', 'v16']:
        identities[line] = {}
        for name in ['kernel', 'angular']:
            selected = config['successors'][line][name]
            assert sha(selected['manifest']) == selected['manifestSha256']
            bindings[selected['manifest']] = selected['manifestSha256']
            manifest = read(selected['manifest'])
            assert manifest['head'] == config['successorHeads'][line]
            assert sha(manifest['buildReceipt']) == manifest['buildReceiptSha256']
            receipt = read(manifest['buildReceipt'])
            assert receipt['exitCode'] == 0 and receipt['sourceUnchanged'] is True
            assert manifest['head'] == receipt['head']
            assert manifest['sourceSeal'] == receipt['sourceSeal']
            assert receipt.get('snapshots'), 'Require preserved source inputs'
            bindings[manifest['buildReceipt']] = manifest['buildReceiptSha256']
            bindings.update(receipt.get('snapshots', {}))
            root = Path(manifest['root'])
            actual = {str(p.relative_to(root)): sha(p) for p in root.rglob('*') if p.is_file()}
            assert actual == manifest['files']
            bindings.update({str(root / p): digest for p, digest in actual.items()})
            identities[line][name] = {key: manifest[key] for key in ['head', 'sourceSeal', 'buildReceiptSha256']}
        assert identities[line]['kernel'] == identities[line]['angular'], 'Require one source/build per facade pair'
    verify(bindings)
    output.mkdir(parents=True)
    save(output / 'config.json', config)
    bindings[str(output / 'config.json')] = sha(output / 'config.json')
    save(output / 'plan.json', {
        'kind': 'startup-economics-application-v1', 'createdUTC': now(),
        'command': [sys.executable, *sys.argv], 'bindings': bindings,
        'identities': identities, 'currentHeads': config['currentHeads'],
        'output': str(output), 'phases': PHASES,
        'counts': {'dispatch': 88, 'context': 32, 'metric': 9,
                   'calibration': 16, 'comparison': 288, 'mainSamples': 240,
                   'sameArtifactSamples': 48, 'admission': 12},
        'limits': ['Current-to-successor pairs, not cumulative historical arms.',
                   'Five rounds, partial order balance, descriptive A/A for both lines.',
                   'Three workload sizes are not representative industry populations.',
                   'Common peer workflow does not reproduce every native v16 guarantee.'],
    })
    print(json.dumps({'planned': str(output), 'measured': False}))


def commands(output):
    packet = output / 'packet'
    app = HERE / 'application'
    lab = CHECKOUT / 'tools/application-lab'
    return {
        'prepare': [NODE, HERE / 'application-prepare.mjs', output / 'config.json', packet],
        'build': [NODE, lab / 'lab.mjs', 'build-dispatch', packet],
        'conformance': [NODE, lab / 'dispatch-check.mjs', packet],
        'context-controls': [NODE, app / 'context-controls.mjs', packet, packet / 'optimization-context-controls'],
        'metric-controls': [NODE, app / 'measure.mjs', 'controls', packet, output / 'metric-controls'],
        'calibration': [NODE, app / 'measure.mjs', 'calibrate', packet, output / 'calibration'],
        'comparison': [NODE, app / 'measure.mjs', 'compare', packet, output / 'comparison', output / 'metric-controls/results.json', output / 'calibration/results.json'],
        'analysis': [NODE, app / 'analyze.mjs', output / 'comparison', output / 'analysis'],
        'admission-controls': [NODE, app / 'analyzer-controls.mjs', output / 'comparison', output / 'admission-controls'],
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
        for prerequisite in PHASES[:PHASES.index(name)]:
            assert read(output / 'commands' / prerequisite / 'receipt.json')['exitCode'] == 0
        verify(registered['bindings'])
        directory = output / 'commands' / name
        directory.mkdir(parents=True)
        args = list(map(str, commands(output)[name]))
        record = {'name': name, 'command': args, 'cwd': str(CHECKOUT),
                  'startedUTC': now(), 'hostLoadBefore': os.getloadavg(),
                  'planSha256': sha(output / 'plan.json')}
        save(directory / 'plan.json', record)
        started = time.monotonic()
        with (directory / 'command.log').open('xb') as log:
            result = subprocess.run(args, cwd=CHECKOUT, env=env, stdout=log, stderr=subprocess.STDOUT)
        record.update(exitCode=result.returncode, seconds=time.monotonic() - started,
                      finishedUTC=now(), hostLoadAfter=os.getloadavg(),
                      logSha256=sha(directory / 'command.log'))
        record['outputs'] = {str(output / relative): sha(output / relative)
                             for relative in OUTPUTS[name] if (output / relative).is_file()}
        save(directory / 'receipt.json', record)
        print(json.dumps({key: record[key] for key in ['name', 'exitCode', 'seconds']}), flush=True)
        assert result.returncode == 0, f'First failure preserved: {directory}'
        verify(registered['bindings'])
    if all((output / 'commands' / p / 'receipt.json').exists() for p in PHASES):
        steps = [read(output / 'commands' / p / 'receipt.json') for p in PHASES]
        assert all(step['exitCode'] == 0 for step in steps)
        save(output / 'driver-results.json', {
            'passed': True, 'steps': steps, 'finishedUTC': now(),
            'planSha256': sha(output / 'plan.json'), 'identities': registered['identities'],
            'counts': registered['counts'], 'limits': registered['limits'],
        })
        admitted = completed_application(output)
        save(output / 'completed-admission.json', {
            'passed': True, 'identities': admitted['identities'],
            'counts': admitted['counts'], 'verifiedBindings': len(admitted['bindings']),
            'generatorSha256': sha(HERE / 'admission.py'),
        })


parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest='action', required=True)
planning = sub.add_parser('plan')
planning.add_argument('config')
planning.add_argument('new_output')
running = sub.add_parser('run')
running.add_argument('output')
running.add_argument('phase', choices=[*PHASES, 'all'])
args = parser.parse_args()
if args.action == 'plan':
    plan(args.config, args.new_output)
else:
    execute(args.output, args.phase)
