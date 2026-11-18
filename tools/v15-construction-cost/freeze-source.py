#!/usr/bin/env python3
"""Record or verify the complete clean tracked candidate, outside its checkout."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

mode, workspace_arg, *paths = sys.argv[1:]
workspace = Path(workspace_arg).resolve()
assert mode in ['record', 'verify']
assert len(paths) == (1 if mode == 'record' else 2)
output = Path(paths[-1]).resolve()
assert workspace != output and workspace not in output.parents
assert not output.exists(), 'Preserve every earlier source-state result'
git = lambda *args: subprocess.check_output(['git', *args], cwd=workspace, text=True)
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert not git('status', '--porcelain'), 'Qualification requires a clean candidate'
files = {name: sha(workspace / name) for name in sorted(git('ls-files', '-z').split('\0')) if name}
record = {'workspace': str(workspace), 'head': git('rev-parse', 'HEAD').strip(),
          'branch': git('branch', '--show-current').strip(), 'files': files,
          'runnerSha256': sha(__file__), 'command': sys.argv}
if mode == 'verify':
    prior = Path(paths[0]).resolve()
    baseline = json.loads(prior.read_text())
    assert baseline['workspace'] == record['workspace']
    assert baseline['head'] == record['head'] and baseline['branch'] == record['branch']
    assert baseline['files'] == files, 'Tracked source did not restore exactly'
    record.update({'baseline': str(prior), 'baselineSha256': sha(prior), 'sourceUnchanged': True})
output.parent.mkdir(parents=True, exist_ok=True)
with output.open('x') as stream:
    json.dump(record, stream, indent=2)
    stream.write('\n')
print(json.dumps({'output': str(output), 'head': record['head'], 'files': len(files), 'mode': mode}))
