#!/usr/bin/env python3
"""Bind source inputs and copy all fresh package payloads; never publish.

snapshot WORKSPACE NEW_OUTPUT records inputs only (no build or dist mutation).
build WORKSPACE NEW_OUTPUT records inputs, removes owned dist and builds serially.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

mode, workspace_arg, output_arg = sys.argv[1:]
assert mode in ['snapshot', 'build']
workspace, output = Path(workspace_arg).resolve(), Path(output_arg).resolve()
runner = Path(__file__).resolve()
assert not output.exists(), 'Preserve prior attempts'
assert output != workspace and not workspace.is_relative_to(output)
assert not output.is_relative_to(workspace / 'dist')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    with Path(path).open('x') as stream:
        json.dump(value, stream, indent=2)
        stream.write('\n')


def execute_read(command):
    return subprocess.check_output(command, cwd=workspace, text=True).strip()


assert execute_read(['node', '--version']) == 'v24.15.0'
assert execute_read(['pnpm', '--version']) == '10.17.0'
declared_workspace = os.environ.get('NX_WORKSPACE_ROOT_PATH')
assert not declared_workspace or Path(declared_workspace).resolve() == workspace
packages = json.loads(execute_read(['node', 'scripts/release-plan.mjs', '--json']))
assert packages and len(set(packages)) == len(packages)
nx = json.loads((workspace / 'nx.json').read_text())
globals_ = nx['namedInputs'].get('packageBuildGlobals', [])
assert all(value.startswith('{workspaceRoot}/') for value in globals_)
# Package sources include adapter-to-kernel imports, every per-package Rollup
# and TS configuration, assets and generated declaration entry configuration.
# This v16 checkout may not declare packageBuildGlobals; consumed shared inputs
# remain explicitly covered below. Include every declared shared build input and broader root tooling/config,
# rather than relying on a hard-coded copy of the old llms omission.
scope = ['packages', 'tools/build', 'scripts', 'package.json', 'pnpm-lock.yaml',
         'pnpm-workspace.yaml', 'nx.json', 'tsconfig*', '.nvmrc', '.npmrc',
         'LICENSE', 'NOTICE', 'llms.txt']
scope += [value.removeprefix('{workspaceRoot}/').replace('/**/*', '')
          for value in globals_]
scope.append(str(runner.relative_to(workspace)))


def inputs():
    names = set()
    for flags in [[], ['--others', '--exclude-standard']]:
        names.update(subprocess.check_output(
            ['git', 'ls-files', '-z', *flags, '--', *scope], cwd=workspace
        ).decode().split('\0'))
    paths = [name for name in sorted(names) if name and (workspace / name).is_file()]
    assert all(not (workspace / name).is_symlink() for name in paths)
    result = {name: sha(workspace / name) for name in paths}
    for required in ['llms.txt', 'LICENSE', 'NOTICE', 'tsconfig.base.json',
                     'tools/build/create-rollup-config.mjs', 'scripts/release-plan.mjs']:
        assert required in result, f'Missing build input: {required}'
    return result


before = inputs()
output.mkdir(parents=True)
snapshots = {}
for name, digest in before.items():
    target = output / 'source' / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(workspace / name, target)
    assert sha(target) == digest
    snapshots[str(target)] = digest
(output / 'source.patch').write_bytes(subprocess.check_output(
    ['git', 'diff', '--binary', 'HEAD'], cwd=workspace))
node = Path(execute_read(['node', '-p', 'process.execPath'])).resolve()
head = execute_read(['git', 'rev-parse', 'HEAD'])
command = ['pnpm', 'nx', 'run-many', '-t', 'build',
           '--projects=' + ','.join(packages), '--parallel=1', '--skip-nx-cache']
source_seal = hashlib.sha256(json.dumps(
    before, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
plan = {
    'head': head, 'sourceSeal': source_seal, 'cwd': str(workspace),
    'startedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'mode': mode, 'command': command, 'packages': packages,
    'bindings': {str(workspace / name): digest for name, digest in before.items()},
    'snapshots': snapshots, 'patchSha256': sha(output / 'source.patch'),
    'status': execute_read(['git', 'status', '--short']),
    'node': {'path': str(node), 'sha256': sha(node)},
    'pnpm': '10.17.0', 'runner': str(runner), 'runnerSha256': sha(runner),
    'inputScope': scope, 'declaredPackageBuildGlobals': globals_,
    'limits': 'Source input snapshots plus pinned lockfile/toolchain. Installed dependencies require frozen-lockfile admission. Snapshot-only mode claims no build. Dirty source is identified by snapshots, not HEAD alone.',
}
write(output / 'plan.json', plan)
if mode == 'snapshot':
    assert before == inputs()
    print(json.dumps({'snapshot': str(output), 'sourceSeal': source_seal,
                      'sourceInputs': len(before), 'built': False}))
    sys.exit(0)

dist = workspace / 'dist'
assert not dist.is_symlink()
write(output / 'dist-removal.json', {'path': str(dist), 'existed': dist.exists()})
if dist.exists():
    shutil.rmtree(dist)
assert not dist.exists()
started = time.monotonic()
with (output / 'build.log').open('xb') as stream:
    completed = subprocess.run(command, cwd=workspace, stdout=stream,
                               stderr=subprocess.STDOUT,
                               env={**os.environ, 'NX_DAEMON': 'false',
                                    'NX_ISOLATE_PLUGINS': 'false', 'CI': 'true'})
same = before == inputs() and execute_read(['git', 'rev-parse', 'HEAD']) == head
receipt = {**plan, 'exitCode': completed.returncode,
           'seconds': time.monotonic() - started, 'sourceUnchanged': same,
           'logSha256': sha(output / 'build.log')}
write(output / 'build-receipt.json', receipt)
assert completed.returncode == 0 and same, 'Build failed/source changed; retain attempt'
for name in packages:
    root = output / name
    shutil.copytree(dist / 'packages' / name, root)
    paths = sorted(path for path in root.rglob('*') if path.is_file())
    assert all(not path.is_symlink() for path in paths)
    files = {str(path.relative_to(root)): sha(path) for path in paths}
    manifest = json.loads((root / 'package.json').read_text())
    assert manifest['name'] == '@signal-tree/' + name
    write(output / (name + '.json'), {
        'kind': 'identified-built-kernel-v1' if name == 'kernel' else 'identified-built-package-v1',
        'head': head, 'sourceSeal': source_seal, 'root': str(root), 'files': files,
        'buildReceipt': str(output / 'build-receipt.json'),
        'buildReceiptSha256': sha(output / 'build-receipt.json'),
        'limits': 'Fresh complete built payload inventory. Canonical packing, installed consumer checks and full release qualification remain separate.',
    })
print(json.dumps({'packages': packages, 'sourceUnchanged': same,
                  'sourceSeal': source_seal, 'output': str(output)}))
