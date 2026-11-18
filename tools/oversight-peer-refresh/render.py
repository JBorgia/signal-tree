#!/usr/bin/env python3
"""Derive identity-correct prose from the existing numerical table renderer."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'optimization-sweep/application-report.py'
ROOT = Path('/Users/jonathanborgia/code/signaltree/artifacts/oversight-peer-refresh-2026-11-17')
assert len(sys.argv) == 2, 'render.py COMPLETED_RUN_DIRECTORY'
run = Path(sys.argv[1]).resolve()
assert run.is_relative_to(ROOT) and run != ROOT
read = lambda path: json.loads(path.read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
plan = read(run / 'plan.json')
driver = read(run / 'driver-results.json')
assert driver['passed'] is True and all(step['exitCode'] == 0 for step in driver['steps'])
assert driver['planSha256'] == sha(run / 'plan.json')
assert driver['qualificationSealSha256'] == sha(run / 'package-identities.json')
for path in [SOURCE, Path(__file__).resolve()]:
    assert sha(path) == plan['bindings'][str(path)]
text = SOURCE.read_text()
changes = [
    ("f'Final v16 source: `{head}`. The v15 candidate is `4d1142d61`.',",
     "f'Current v16 source: `{head}`. Selected v15 source: `{driver[\"v15Head\"]}`.',"),
    ("'described in [the report](README.md).', '',",
     "'identified by this run’s plan.json and package-identities.json.', '',"),
    ("'The fixed workload runs through `run-t-application-final.py` in the',\n          'frozen final-followthrough source1 packet. The numerical generator is',",
     "'The fixed workload runs through `tools/oversight-peer-refresh/refresh.py`',\n          'with unchanged pinned peer strategies. The numerical generator is',"),
    ('Qualified package seal SHA-256:', 'Selected package identity seal SHA-256:'),
    ("('v16-before', 'v16 C1')", "('v16-before', 'v16 frozen baseline')"),
]
for before, after in changes:
    assert text.count(before) == 1, f'Identity-only renderer anchor: {before}'
    text = text.replace(before, after)
directory = run / 'renderer'
directory.mkdir()
derived = directory / 'application-report-identified.py'
derived.write_text(text)
derivation = {'original': str(SOURCE), 'originalSha256': sha(SOURCE),
              'derived': str(derived), 'derivedSha256': sha(derived),
              'changes': [{'before': before, 'after': after} for before, after in changes],
              'scope': 'Identity and replay prose only. Numerical table logic unchanged.'}
(directory / 'derivation.json').write_text(json.dumps(derivation, indent=2) + '\n')
command = [sys.executable, str(derived), str(run / 'analysis/summary.json'),
           str(run / 'driver-results.json'), str(run / 'comparison-tables.md')]
with (directory / 'command.log').open('xb') as log:
    result = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT)
(directory / 'receipt.json').write_text(json.dumps({
    'command': command, 'exitCode': result.returncode,
    'logSha256': sha(directory / 'command.log'),
    'derivationSha256': sha(directory / 'derivation.json')}, indent=2) + '\n')
assert result.returncode == 0, 'Renderer failure preserved'
print(json.dumps({'output': str(run / 'comparison-tables.md'),
                  'sha256': sha(run / 'comparison-tables.md')}))
