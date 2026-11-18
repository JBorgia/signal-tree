"""Exercise both selected public contracts and the installed v16 durable app.

Usage: run-oversight.py QUALIFICATION_ROOT NEW_OUTPUT
The qualified build is repacked by the unchanged public helper; shipped payloads
must equal the canonical archives. Requires the exclusive heavy-work slot.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from admission import canonical_packages

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ROOT = Path('/Users/jonathanborgia/code/signaltree')
NODE = Path('/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node')
read = lambda p: json.loads(Path(p).read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
qualification, out = map(lambda p: Path(p).resolve(), sys.argv[1:])
assert out.is_relative_to(ROOT / 'artifacts/startup-market-economics-2026-11-18')
assert not out.exists()
admitted = {line: canonical_packages(qualification, line) for line in ['v15', 'v16']}
out.mkdir(parents=True)
lab = REPO / 'tools/agent-oversight-lab'
source_files = [HERE / 'run-command.py', HERE / 'admission.py', Path(__file__), lab / 'prepare.mjs', lab / 'run.mjs', lab / 'oversight.checks.mjs']
for folder in ['application', 'durable-authority']:
    source_files.extend(p for p in (lab / folder).rglob('*') if p.is_file())
for folder in ['tools/agent-collaboration-lab', 'tools/experiments/multi-actor-operations']:
    source_files.extend(p for p in (REPO / folder).rglob('*') if p.is_file())
bindings = {str(p): sha(p) for p in source_files}
for entry in admitted.values():
    bindings.update(entry['bindings'])
for line in ['v15', 'v16']:
    for p in [qualification / (line + '-final-artifact-checks/result.json'), qualification / (line + '-final-artifact-checks/packed-payloads.json')]:
        bindings[str(p)] = sha(p)
steps = []
for line in ['v15', 'v16']:
    steps += [(line + '-prepare', [NODE, lab / 'prepare.mjs', qualification / (line + '-final-packages'), out / (line + '-packet')]),
              (line + '-contracts', [NODE, lab / 'run.mjs', out / (line + '-packet/config.json'), out / (line + '-contracts'), line[1:]])]
steps += [('application-build', [NODE, lab / 'application/build.mjs', out / 'v16-packet/config.json', out / 'application-build']),
          ('application-browser', [NODE, lab / 'application/run.mjs', out / 'application-build/manifest.json', out / 'application-browser']),
          ('application-controls', [NODE, lab / 'application/controls.mjs', out / 'application-build/manifest.json', out / 'application-controls'])]
(out / 'plan.json').write_text(json.dumps({'command': [sys.executable, *sys.argv], 'bindings': bindings,
                                         'steps': [(name, list(map(str, args))) for name, args in steps],
                                         'limits': 'Actual selected public runtime payloads. Existing backend source unchanged; this reruns the installed application, not a new hosted/IdP/private-Studio qualification.'}, indent=2) + '\n')
env = dict(os.environ)
env.pop('NODE_OPTIONS', None)
env['PATH'] = str(NODE.parent) + os.pathsep + env['PATH']
receipts, joins = [], {}
for name, command in steps:
    for p, digest in bindings.items():
        assert sha(p) == digest, p
    log = out / 'commands' / name
    process = subprocess.run([sys.executable, str(HERE / 'run-command.py'), str(log), str(REPO), *map(str, command)], env=env)
    receipt = read(log / 'receipt.json')
    receipts.append({'name': name, 'receipt': str(log / 'receipt.json'), 'sha256': sha(log / 'receipt.json'), 'exitCode': receipt['exitCode']})
    assert process.returncode == 0, f'First failure preserved: {log}'
    if name.endswith('-prepare'):
        line = name.removesuffix('-prepare')
        plan = read(out / (line + '-packet/plan.json'))
        canonical = read(qualification / (line + '-final-artifact-checks/packed-payloads.json'))
        assert canonical['head'] == admitted[line]['head']
        for package in ['kernel', 'angular']:
            assert plan['payloads'][package] == canonical['payloads'][package]
        assert plan['sourceIdentity']['head'] == canonical['head']
        joins[line] = {'head': canonical['head'], 'sourceIdentity': plan['sourceIdentity'],
                       'payloadCounts': {name: len(plan['payloads'][name]) for name in ['kernel', 'angular']},
                       'scope': 'Every shipped payload equals canonical qualified packages; repack container bytes need not be identical.'}
for p, digest in bindings.items():
    assert sha(p) == digest
(out / 'results.json').write_text(json.dumps({'passed': True, 'commands': receipts, 'canonicalPayloadJoins': joins,
                                             'planSha256': sha(out / 'plan.json')}, indent=2) + '\n')
print(json.dumps({'passed': True, 'output': str(out)}))
