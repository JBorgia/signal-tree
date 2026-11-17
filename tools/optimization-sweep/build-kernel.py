#!/usr/bin/env python3
"""Build through Nx with immutable input snapshots and a fresh payload receipt."""
import datetime, hashlib, json, os, pathlib, shutil, subprocess, sys, time

workspace, output = (pathlib.Path(value).resolve() for value in sys.argv[1:])
assert not output.exists(), 'Preserve previous attempts'
output.mkdir(parents=True)
sha = lambda path: hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
write = lambda path, value: path.write_text(json.dumps(value, indent=2) + '\n')
scope = ['packages/kernel', 'tools/build', 'package.json', 'pnpm-lock.yaml',
         'nx.json', 'tsconfig*', '.nvmrc', '.npmrc', 'LICENSE', 'NOTICE']
def inputs():
    names = set()
    for flags in [[], ['--others', '--exclude-standard']]:
        names.update(subprocess.check_output(['git', 'ls-files', '-z', *flags, '--', *scope], cwd=workspace).decode().split('\0'))
    return {name: sha(workspace / name) for name in sorted(names) if name and (workspace / name).is_file()}
before = inputs()
snapshots = {}
for name, digest in before.items():
    target = output / 'source' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(workspace / name, target)
    assert sha(target) == digest
    snapshots[str(target)] = digest
patch = subprocess.check_output(['git', 'diff', '--binary'], cwd=workspace)
(output / 'source.patch').write_bytes(patch)
command = ['pnpm', 'nx', 'build', 'kernel', '--skip-nx-cache']
plan = {'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=workspace, text=True).strip(),
        'startedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'command': command,
        'cwd': str(workspace), 'bindings': {str(workspace / name): digest for name, digest in before.items()},
        'snapshots': snapshots, 'patchSha256': sha(output / 'source.patch')}
write(output / 'plan.json', plan)
start = time.monotonic()
with (output / 'build.log').open('xb') as stream:
    completed = subprocess.run(command, cwd=workspace, stdout=stream, stderr=subprocess.STDOUT,
                               env={**os.environ, 'NX_DAEMON': 'false', 'NX_ISOLATE_PLUGINS': 'false', 'CI': 'true'})
same = before == inputs()
receipt = {**plan, 'exitCode': completed.returncode, 'seconds': time.monotonic() - start,
           'sourceUnchanged': same, 'logSha256': sha(output / 'build.log')}
write(output / 'build-receipt.json', receipt)
assert completed.returncode == 0 and same, 'Build failed or its inputs changed; preserve attempt'
root = output / 'kernel'
shutil.copytree(workspace / 'dist/packages/kernel', root)
files = {str(path.relative_to(root)): sha(path) for path in sorted(root.rglob('*')) if path.is_file()}
write(output / 'kernel.json', {'kind': 'identified-built-kernel-v1', 'head': plan['head'], 'root': str(root),
    'files': files, 'buildReceipt': str(output / 'build-receipt.json'), 'buildReceiptSha256': sha(output / 'build-receipt.json'),
    'limits': 'Exact pre/post source input and built payload identity. HEAD plus dirty-source snapshots/patch identify this prototype; this is not canonical release packaging or all-package qualification.'})
print(json.dumps({'built': str(root), 'files': len(files), 'sourceInputs': len(before), 'sourceUnchanged': same,
                  'kernelManifestSha256': sha(output / 'kernel.json')}), flush=True)
