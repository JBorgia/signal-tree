#!/usr/bin/env python3
"""Record a fresh validation attempt; never replace earlier failures."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

output, workspace = (Path(value).resolve() for value in sys.argv[1:3])
command = sys.argv[3:]
assert command and not output.exists()
output.mkdir(parents=True)
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
write = lambda name, value: (output / name).write_text(json.dumps(value, indent=2) + '\n')
git = lambda *args: subprocess.check_output(['git', *args], cwd=workspace, text=True)
patch = git('diff', '--binary', 'HEAD')
(output / 'source.patch').write_text(patch)
plan = {
    'command': command, 'cwd': str(workspace),
    'startedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': git('rev-parse', 'HEAD').strip(), 'status': git('status', '--short'),
    'patchSha256': sha(output / 'source.patch'),
    'runnerSha256': sha(__file__),
    'node': subprocess.check_output(['node', '--version'], text=True).strip(),
}
write('plan.json', plan)
started = time.monotonic()
with (output / 'command.log').open('xb') as log:
    result = subprocess.run(command, cwd=workspace, stdout=log, stderr=subprocess.STDOUT,
        env={**os.environ, 'NX_DAEMON': 'false', 'NX_ISOLATE_PLUGINS': 'false', 'CI': 'true'})
receipt = {**plan, 'exitCode': result.returncode, 'seconds': time.monotonic() - started,
           'logSha256': sha(output / 'command.log'),
           'trackedPatchUnchanged': patch == git('diff', '--binary', 'HEAD')}
write('receipt.json', receipt)
print(json.dumps({'path': str(output), 'exitCode': result.returncode, 'seconds': receipt['seconds']}), flush=True)
sys.exit(result.returncode)
