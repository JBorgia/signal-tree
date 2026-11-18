"""Collect this bounded run's identified inputs and results; not a release packer."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys

artifacts, report = map(Path, sys.argv[1:])
prefix = 'agent-oversight-2026-11-17-'
destination = report / 'evidence'
destination.mkdir()
manifest = {}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def copy(source, relative):
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    assert sha(source) == sha(target)
    manifest[str(relative)] = {'sha256': sha(target), 'original': str(source)}

def data(path):
    return json.loads(path.read_text())

results = {'scope': 'Functional observations and explicit limitation witnesses; not an overall oversight-product or release pass', 'runs': {}, 'artifacts': {}}
for line, name, packet in [('15', 'v15-common-1', 'v15-packet-2'), ('16', 'v16-common-5', 'v16-packet-3')]:
    root = artifacts / (prefix + name)
    receipt = data(root / 'receipt.json')
    assert receipt['outcome'] == 'PASS'
    log = (root / 'oversight.log').read_text()
    assert re.search(r'pass 9\b', log) and re.search(r'fail 0\b', log)
    diagnostics = [json.loads(s[s.index('{'):]) for s in log.splitlines() if s.startswith('ℹ {')]
    source = root / 'consumer/oversight.checks.mjs'
    expected_source = next(v for k, v in receipt['inputs'].items() if k.endswith('/tools/agent-oversight-lab/oversight.checks.mjs'))
    assert sha(source) == expected_source
    for p in [root / 'receipt.json', root / 'oversight.log', source]:
        copy(p, Path(name) / p.name)
    results['runs'][name] = {'line': line, 'assertionCases': 9, 'passed': 9, 'diagnostics': diagnostics, 'testSourceSha256': sha(source), 'commands': receipt['commands']}
    packet_root = artifacts / (prefix + packet)
    config = data(packet_root / 'config.json')
    plan = data(Path(config['artifactPlan']))
    assert sha(Path(config['artifactPlan'])) == config['artifactPlanSha256']
    for p in [packet_root / 'config.json', packet_root / 'plan.json']:
        copy(p, Path(packet) / p.name)
    for artifact in config['artifacts'].values():
        p = Path(artifact['archive'])
        copy(p, Path(packet) / 'packs' / p.name)
    for source_path, expected in plan['inputs'].items():
        p = Path(source_path)
        assert sha(p) == expected
        copy(p, Path(packet) / 'build-inputs' / p.name)
    results['artifacts'][line] = config['sourceIdentity']
assert results['runs']['v15-common-1']['testSourceSha256'] == results['runs']['v16-common-5']['testSourceSha256']

public = artifacts / (prefix + 'v16-run-3/public')
public_result = data(public / 'browser-results.json')
assert len(public_result['results']) == 15
assert all(r['outcome'] == 'PASS' for r in public_result['results'])
log = (public / 'logs/coordinator-protocol-http.log').read_text()
assert re.search(r'pass 62\b', log) and re.search(r'fail 0\b', log)
results['runs']['existing-public-v16'] = {'nodePassed': 62, 'angularBrowserPassed': 15, 'note': 'Public workflow passed; the enclosing earlier common-suite attempt failed its scalar-trigger assumption and is preserved separately.'}
for p in [public / 'manifest.json', public / 'browser-results.json', public / 'logs/coordinator-protocol-http.log', public / 'logs/aot.log']:
    copy(p, Path('existing-public-v16') / p.name)

for name in ['http-browser-1', 'http-control-settlement', 'http-control-instance']:
    root = artifacts / (prefix + name)
    receipt = data(root / 'manifest.json')
    report_data = data(root / 'browser-results.json')
    assert receipt['complete'] is True and report_data['passed'] is True
    control = receipt['control'] != 'none'
    assert report_data['controlDetected'] is control
    if not control:
        assert len(report_data['results']) == 12
        assert all(r['outcome'] == 'PASS' for r in report_data['results'])
    results['runs'][name] = {'control': receipt['control'], 'controlDetected': report_data['controlDetected'], 'cases': [{k: r[k] for k in ['id', 'outcome']} for r in report_data['results']], 'command': receipt['command']}
    for p in [root / 'manifest.json', root / 'browser-results.json']:
        copy(p, Path(name) / p.name)
    for p in (root / 'logs').glob('*.log'):
        copy(p, Path(name) / 'logs' / p.name)

for name, paths in {
    'v16-packet': ['angular-pack.log', 'kernel-pack.log'],
    'v16-run-2': ['receipt.json', 'public-workflow.log', 'public/logs/coordinator-protocol-http.log'],
    'v16-run-3': ['receipt.json', 'oversight.log', 'public/consumer/oversight.checks.mjs'],
    'v16-common-4': ['receipt.json', 'install.log'],
}.items():
    for relative in paths:
        p = artifacts / (prefix + name) / relative
        copy(p, Path('first-attempts') / name / relative)

copy(Path(__file__), Path('collect.py'))
(report / 'RESULTS.json').write_text(json.dumps(results, indent=2) + '\n')
(report / 'EVIDENCE.json').write_text(json.dumps({'files': manifest, 'resultsSha256': sha(report / 'RESULTS.json'), 'limits': 'Selected raw outputs, source copies and exact package archives. External peer/tool installations and all repository history are not bundled; absolute paths record the original execution.'}, indent=2) + '\n')
print(json.dumps({'copiedFiles': len(manifest), 'results': str(report / 'RESULTS.json')}))
