#!/usr/bin/env python3
"""Require byte equality between a measured kernel and a fresh final build."""
from pathlib import Path
import hashlib
import json
import sys

if not __debug__:
    raise RuntimeError('Integrity assertions require ordinary Python execution')
measured, final, output = (Path(value).resolve() for value in sys.argv[1:])
assert not output.exists()
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
records = []
for path in [measured, final]:
    manifest = json.loads(path.read_text())
    root = Path(manifest['root'])
    files = {str(p.relative_to(root)): sha(p) for p in root.rglob('*') if p.is_file()}
    assert files and files == manifest['files']
    assert sha(manifest['buildReceipt']) == manifest['buildReceiptSha256']
    receipt = json.loads(Path(manifest['buildReceipt']).read_text())
    assert receipt['sourceUnchanged'] is True and receipt['exitCode'] == 0
    assert receipt['head'] == manifest['head']
    records.append({'manifest': str(path), 'manifestSha256': sha(path), 'head': manifest['head'], 'files': files})
assert records[0]['files'] == records[1]['files'], 'Final kernel differs from measured payloads'
result = {'command': sys.argv, 'runnerSha256': sha(__file__), 'artifacts': records,
          'identicalPayloads': len(records[0]['files']), 'allPayloadBytesIdentical': True,
          'limits': 'Exact built-file equality; source commits differ and retain their own identities. No statistical or universal performance claim.'}
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'identicalPayloads': result['identicalPayloads'], 'allPayloadBytesIdentical': True}))
