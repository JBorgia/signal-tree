"""Join the completed public follow-through receipts; retain failed size gates."""
import hashlib
import json
from pathlib import Path
import re
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE')

artifacts, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
assert not output.exists()
bindings = {}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(relative):
    path = artifacts / relative
    bindings[str(path)] = sha(path)
    return json.loads(path.read_text())


def verify(values):
    for name, expected in values.items():
        assert sha(name) == expected, name


backend = read('agent-oversight-durable-2026-11-17-run-3/receipt.json')
assert backend['exitCode'] == 0
verify(backend['inputs'])
assert sha(backend['log']) == backend['logSha256']
log = Path(backend['log']).read_text()
assert re.search(r'pass 15\b', log) and re.search(r'fail 0\b', log)
backend_controls = read('agent-oversight-durable-2026-11-17-controls-1/receipt.json')
assert len(backend_controls['results']) == 4
for row in backend_controls['results']:
    assert row['exitCode'] == (1 if row['mutant'] else 0)
    directory = Path(row['command'][-1])
    assert sha(directory / 'test.log') == row['logSha256']
    assert sha(directory / 'store.mjs') == row['sourceHash']
    if row['mutant']:
        oracle, effects = ('authorization-zero-effects', 1) if row['kind'] == 'authorization' else ('duplicate-one-effect', 2)
        text = (directory / 'test.log').read_text()
        assert f'"oracle":"{oracle}","effects":{effects}' in text
        assert 'AssertionError' in text and oracle in text
assert {row['kind'] for row in backend_controls['results']} == {'authorization', 'duplicate-effect'}

build = read('oversight-application-2026-11-17-build-4/manifest.json')
browser = read('oversight-application-2026-11-17-browser-4/manifest.json')
controls = read('oversight-application-2026-11-17-controls-3/receipt.json')
assert build['complete'] and browser['passed'] and controls['passed']
verify(build['sources'])
verify(browser['bindings'])
verify(controls['bindings'])
cases = browser['results']['cases']
assert len(cases) == 12 and len({row['id'] for row in cases}) == 12
assert all(row['passed'] for row in cases)
assert len(controls['results']) == 3
assert all(row['detected'] for row in controls['results'])

v15 = read('v15-oversight-cost-2026-11-17/qualification/result.json')
assert v15['checksComplete'] and v15['sourceUnchanged'] and not v15['publication']
assert v15['normal']['passed'] == 90 and v15['normal']['failed'] == 1
assert v15['mutations']['proven'] == 91
assert not v15['budgets']['numericPassed']
for row in v15['receipts'].values():
    assert sha(row['path']) == row['sha256']
assert v15['routeStats']['expected'] == 146
assert all(v15['routeStats'][key] == 0 for key in ['skipped', 'unexpected', 'flaky'])

peer = read('oversight-peer-refresh-2026-11-17/run-1/driver-results.json')
plan = read('oversight-peer-refresh-2026-11-17/run-1/plan.json')
identities = read('oversight-peer-refresh-2026-11-17/run-1/package-identities.json')
runtime_identities = read('oversight-peer-refresh-2026-11-17/run-1/runtime-identities.json')
completed = read('oversight-peer-refresh-2026-11-17/run-1/completed-counts.json')
assert completed['counts'] == {'dispatch': 88, 'context': 32, 'metric': 9,
                                'calibration': 16, 'comparison': 176, 'analyzer': 12}
for name, row in completed['receipts'].items():
    assert sha(row['path']) == row['sha256']
    assert row['completed'] == completed['counts'][name]
assert peer['passed'] and len(peer['steps']) == 9
assert all(row['exitCode'] == 0 for row in peer['steps'])
assert peer['v15Head'] == v15['head']
assert peer['candidateHead'] == build['sourceIdentity']['head']
assert identities['v16']['kernel']['sourceSeal'] == build['sourceIdentity']['sourceSeal']
verify(plan['bindings'])


def tar_payloads(path):
    payloads = {}
    with tarfile.open(path, 'r:gz') as stream:
        for member in stream:
            if member.isdir():
                continue
            assert member.isfile() and member.name not in payloads
            payloads[member.name] = stream.extractfile(member).read()
    return payloads


cross_proof = {}
for name in ['kernel', 'angular']:
    app_archive = build['artifacts'][name]['archive']
    peer_archive = runtime_identities['identities']['v16'][name]['archive']
    app_files, peer_files = tar_payloads(app_archive), tar_payloads(peer_archive)
    assert set(app_files).issubset(peer_files)
    assert all(peer_files[key] == value for key, value in app_files.items())
    extra = set(peer_files) - set(app_files)
    assert extra == (set() if name == 'kernel' else {'package/dist/index.d.ts'})
    manifest = json.loads(app_files['package/package.json'])
    if extra:
        assert manifest['types'] == manifest['exports']['.']['types'] == './src/index.d.ts'
        assert './dist/index.d.ts' not in json.dumps(manifest['exports'])
        assert 'dist/**/*.d.ts' not in manifest['files']
    cross_proof[name] = {'applicationArchiveSha256': sha(app_archive),
                         'peerArchiveSha256': sha(peer_archive),
                         'identicalSharedPayloads': len(app_files),
                         'peerOnlyNonExportedBuildFiles': sorted(extra)}

result = {
    'generator': {'command': [sys.executable, *sys.argv], 'sha256': sha(__file__)},
    'scope': 'Completed bounded application proof, local v15 qualification and pinned peer refresh; no publication.',
    'sourceIdentities': {'v15': {'head': v15['head'], 'qualificationSha256':
        bindings[str(artifacts / 'v15-oversight-cost-2026-11-17/qualification/result.json')]},
        'v16': build['sourceIdentity']},
    'backend': {'passedCases': 15, 'controlsDetected': 2,
                'command': backend['command'], 'limits': backend['limits']},
    'application': {'buildCommand': build['command'], 'browserCommand': browser['command'],
                    'controlCommand': controls['command'], 'cases': cases,
                    'controls': [{key: row[key] for key in ['id', 'expected', 'detected']}
                                 for row in controls['results']], 'limits': browser['limits']},
    'v15Qualification': v15,
    'peerRefresh': {'planCommand': plan['command'], 'steps': peer['steps'],
                    'completedCounts': completed, 'identities': identities,
                    'crossProofPayloadJoin': cross_proof, 'limits': plan['limits']},
    'privateStudio': 'Separate private delivery; private source, raw results and detailed cost interpretation excluded.',
    'humanParticipants': 0,
    'bindings': bindings,
}
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(output), 'sha256': sha(output), 'boundReceipts': len(bindings)}))
