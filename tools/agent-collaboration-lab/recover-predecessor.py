#!/usr/bin/env python3
"""Restore exact temporary predecessor inputs from the verified published archive.

Never changes existing unequal files or any repository source. New evidence lives
in the persistent output, not in the restored temporary input locations.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

evidence, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
output.mkdir(parents=True, exist_ok=False)
manifest_path = evidence / 'manifest.json'
sha = lambda data: hashlib.sha256(data).hexdigest()
assert sha(manifest_path.read_bytes()) == '11e010c1a8044e8cde4fb9843ab23cc70eb192b370dbd7142a3fa9f60c8c964a'
manifest = json.loads(manifest_path.read_text())
versions = {}
for entry in manifest['entries']:
    versions.setdefault(entry['original'], set()).add(entry['sha256'])
restored = {}
allowed_roots = [Path('/private/tmp'), Path(os.environ['TMPDIR']).resolve()]

def is_temporary(original):
    target = Path(original).resolve()
    return any(target.is_relative_to(root) for root in allowed_roots)

def payload(original, digest=None):
    available = versions[original]
    if digest is None:
        assert len(available) == 1, (original, 'Multiple historical versions require an explicit hash')
        digest = next(iter(available))
    assert digest in available, (original, digest)
    data = (evidence / manifest['payloads'][digest]['path']).read_bytes()
    assert sha(data) == digest
    return data, digest

def restore(original, digest=None):
    assert is_temporary(original), original
    data, digest = payload(original, digest)
    target = Path(original)
    if target.exists():
        assert target.is_file() and sha(target.read_bytes()) == digest, ('Refusing overwrite', original)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    restored[original] = digest
    return data

packet = '/private/tmp/st-final-application-packet'
plan_data = restore(packet + '/plan.json', '252919614fb027184d93cc9d59f61dc4f637755393e32786f772d57aafc94e64')
plan = json.loads(plan_data)
required = dict(plan['inputs'])
for name in ['build.json', 'dispatch-build.json']:
    built = json.loads(restore(packet + '/' + name))
    assert built['planSha256'] == sha(plan_data)
    for arm in built['arms'].values():
        for category in ['dependencies', 'served']:
            for path, digest in arm[category].items():
                if path in required:
                    assert required[path] == digest, ('Conflicting required versions', path)
                required[path] = digest
for path, digest in required.items():
    if is_temporary(path):
        restore(path, digest)
for name in ['package.json', 'package-lock.json']:
    restore(plan['toolchainDirectory'] + '/' + name)
packages = {}
for name in ['kernel', 'angular']:
    prefix = packet + '/v16/node_modules/@signal-tree/' + name + '/'
    files = {path[len(prefix):]: digest for path, digest in plan['inputs'].items() if path.startswith(prefix)}
    assert len(files) == (144 if name == 'kernel' else 16)
    for relative, digest in files.items():
        data, _ = payload(prefix + relative, digest)
        target = output / name / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    packages[name] = files
receipt = {'command': [sys.executable, *sys.argv], 'manifestPath': str(manifest_path),
           'manifestSha256': sha(manifest_path.read_bytes()), 'restoredInputs': restored,
           'packages': packages, 'toolchainDirectory': plan['toolchainDirectory'],
           'sourceCommit': '5d04ff65d2eaab1986ed1b420cbc013edc01542b',
           'limits': 'Exact archived input recovery; no new installation, qualification or measurement.'}
(output / 'recovery.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'restoredFiles': len(restored), 'packages': {name: len(files) for name, files in packages.items()}, 'toolchainDirectory': plan['toolchainDirectory']}))
