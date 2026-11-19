"""Run an explicit pnpm command against a verified reconstruction (no install)."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

here = Path(__file__).resolve().parent
if len(sys.argv) < 4:
    raise SystemExit('Usage: replay.py SOURCE NEW_OUTPUT pnpm_arguments...')
source, output = [Path(p).resolve() for p in sys.argv[1:3]]
manifest = json.loads((here / 'SCOPED-MANIFEST.json').read_text())
modes = json.loads((here / 'SCOPED-MODES.json').read_text())
for entry in json.loads((here / 'ASSET-SUPPLEMENT.json').read_text())['entries']:
    manifest[entry['path']] = entry['sha256']
    modes[entry['path']] = {'mode': entry['mode']}
def verify():
    for name, digest in manifest.items():
        assert hashlib.sha256((source / name).read_bytes()).hexdigest() == digest, name
        assert (source / name).stat().st_mode & 0o777 == int(modes[name]['mode'], 8), name
verify()
assert subprocess.check_output(['node', '--version'], text=True).strip() == 'v24.15.0'
assert subprocess.check_output(['pnpm', '--version'], text=True).strip() == '10.17.0'
output.mkdir(parents=True, exist_ok=False)
for name in ['observations', 'public-observations', 'tmp', 'diagnostics']:
    (output / name).mkdir()
env = os.environ.copy()
env.update(NX_DAEMON='false', NX_ISOLATE_PLUGINS='false', NX_TUI='false',
           NX_CACHE_DIRECTORY=str(output / 'nx-cache'),
           NX_WORKSPACE_DATA_DIRECTORY=str(output / 'nx-data'),
           ST_C21_DIAGNOSTIC_OUTPUT=str(output / 'diagnostics'),
           ST_PREPARED_REVIEW_OUTPUT=str(output / 'observations'),
           ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(output / 'public-observations'), TMPDIR=str(output / 'tmp'))
# Use only this disclosed preload; do not inherit an unknown NODE_OPTIONS hook.
env['NODE_OPTIONS'] = '--require ' + json.dumps(str(here / 'diagnostic-redirect.cjs'))
# Optional experiment outputs/selectors must not leak in from the invoking shell.
for name in ['SEMANTICS_REPORT','ST_PACKET_PAIR_OUTPUT','ST_POINT_ALLOCATION_OUTPUT',
             'ST_SINGLETON_ALLOCATION_OUTPUT','ST_MEMBERSHIP_REPLAY_OUTPUT',
             'ST_PERF_OUTPUT_FILE','ST_PERF','ST_RETIREMENT_FAULT','ST_GC_ARM','ST_GC_OUTPUT']:
    env.pop(name, None)
command = ['pnpm', *sys.argv[3:]]
(output / 'COMMAND.json').write_text(json.dumps({'cwd': str(source), 'argv': command,
    'environmentOverrides': {k: env[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI',
    'NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','ST_C21_DIAGNOSTIC_OUTPUT','ST_PREPARED_REVIEW_OUTPUT','ST_PUBLIC_DIAGNOSTIC_OUTPUT','TMPDIR','NODE_OPTIONS']}}, indent=2)+'\n')
with (output / 'first.log').open('w') as log:
    result = subprocess.run(command, cwd=source, env=env, stdout=log, stderr=subprocess.STDOUT)
verify()
(output / 'RESULT.json').write_text(json.dumps({'exitCode': result.returncode,
    'sourceUnchanged': True, 'qualification': 'Inspect actual test selection/counts; exit zero alone is not conformance.'}, indent=2)+'\n')
raise SystemExit(result.returncode)
