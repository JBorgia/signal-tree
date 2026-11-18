"""Run the frozen native workflow against the completed application artifacts.

Usage: run-native.py COMPLETED_APPLICATION_RUN NEW_OUTPUT
Requires exclusive heavy-work slot. Every command/output is preserved.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from admission import completed_application

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
ROOT = Path('/Users/jonathanborgia/code/signaltree')
NODE = Path('/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node')
read = lambda p: json.loads(Path(p).read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()

app, out = map(lambda p: Path(p).resolve(), sys.argv[1:])
assert out.is_relative_to(ROOT / 'artifacts/startup-market-economics-2026-11-18')
assert not out.exists(), 'Preserve first failures'
admitted = completed_application(app)
out.mkdir(parents=True)
config = {'kind': 'native-final-config-v1', 'artifactPlan': str(app / 'packet/plan.json'),
          'artifactPlanSha256': sha(app / 'packet/plan.json'),
          'dispatchBuild': str(app / 'packet/dispatch-build.json'),
          'dispatchBuildSha256': sha(app / 'packet/dispatch-build.json')}
(out / 'config.json').write_text(json.dumps(config, indent=2) + '\n')
bindings = {str(p): sha(p) for p in [Path(__file__), HERE / 'run-command.py', app / 'driver-results.json', out / 'config.json', *sorted((HERE / 'native-final').iterdir())] if p.is_file()}
bindings.update(admitted['bindings'])
bindings[str(HERE / 'admission.py')] = sha(HERE / 'admission.py')
packet = out / 'packet'
steps = [('prepare', [NODE, HERE / 'native-final/prepare.mjs', out / 'config.json', packet])]
steps.append(('schema-controls', [NODE, packet / 'tools/helper.mjs', out / 'schema-controls.json']))
for kind in ['controls', 'functional', 'cpu', 'heap']:
    args = [NODE, packet / 'tools/run.mjs', 'plan', packet / 'packet.json', kind, out / kind]
    if kind in ['cpu', 'heap']:
        args.append(out / 'controls/execution/results.json')
    steps += [(kind + '-plan', args), (kind, [NODE, packet / 'tools/run.mjs', 'run', out / kind / 'plan.json'])]
steps.append(('analysis', [NODE, packet / 'tools/analyze.mjs', out / 'cpu/execution/results.json', out / 'heap/execution/results.json', out / 'functional/execution/results.json', out / 'analysis']))
(out / 'plan.json').write_text(json.dumps({'command': [sys.executable, *sys.argv], 'bindings': bindings,
                                          'steps': [(name, list(map(str, args))) for name, args in steps],
                                          'counts': {'controls': 10, 'functional': 12, 'cpu': 32, 'heap': 12}}, indent=2) + '\n')
env = dict(os.environ)
env.pop('NODE_OPTIONS', None)
env.pop('ESBUILD_BINARY_PATH', None)
env['PATH'] = str(NODE.parent) + os.pathsep + env['PATH']
receipts = []
for name, command in steps:
    for p, digest in bindings.items():
        assert sha(p) == digest, p
    log = out / 'commands' / name
    process = subprocess.run([sys.executable, str(HERE / 'run-command.py'), str(log), str(REPO), *map(str, command)], env=env)
    receipt = read(log / 'receipt.json')
    receipts.append({'name': name, 'receipt': str(log / 'receipt.json'), 'sha256': sha(log / 'receipt.json'), 'exitCode': receipt['exitCode']})
    assert process.returncode == 0, f'First failure preserved: {log}'
for p, digest in bindings.items():
    assert sha(p) == digest
(out / 'results.json').write_text(json.dumps({'passed': True, 'commands': receipts, 'planSha256': sha(out / 'plan.json'),
                                             'counts': {'controls': 10, 'functional': 12, 'cpu': 32, 'heap': 12},
                                             'limits': 'Two identified v16 artifacts with native semantics; no peer-equivalence, human usability or production security claim.'}, indent=2) + '\n')
print(json.dumps({'passed': True, 'output': str(out)}))
