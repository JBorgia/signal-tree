"""Join hash-checked evidence parts into a new directory, preserving the index.

Usage: assemble-evidence.py EVIDENCE-PARTS.json NEW_DIRECTORY
Then run the existing payload verifier against NEW_DIRECTORY/EVIDENCE.json.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE')

manifest_path, output = map(lambda p: Path(p).resolve(), sys.argv[1:])
manifest = json.loads(manifest_path.read_text())
assert manifest['format'] == 'signaltree-evidence-parts-v1'
assert not output.exists(), 'Preserve previous attempts'
assert manifest['index']['file'] == 'EVIDENCE.json'
index_path = manifest_path.parent / 'EVIDENCE.json'
index_bytes = index_path.read_bytes()
assert hashlib.sha256(index_bytes).hexdigest() == manifest['index']['sha256']
index = json.loads(index_bytes)
assert manifest['archive']['file'] == index['archive']['file'] == 'evidence.tar.gz'
assert manifest['archive']['sha256'] == index['archive']['sha256']
parts = manifest['parts']
assert parts and [part['ordinal'] for part in parts] == list(range(len(parts)))
assert len({part['file'] for part in parts}) == len(parts)
for part in parts:
    assert Path(part['file']).name == part['file'] and part['file'] not in ['.', '..']
    assert isinstance(part['bytes'], int) and part['bytes'] > 0
    assert (manifest_path.parent / part['file']).is_file(), 'Missing evidence part'
assert sum(part['bytes'] for part in parts) == manifest['archive']['bytes']
output.mkdir(parents=True)
joined = hashlib.sha256()
with (output / 'evidence.tar.gz').open('xb') as target:
    for part in parts:
        payload = (manifest_path.parent / part['file']).read_bytes()
        assert len(payload) == part['bytes'], 'Evidence part size mismatch'
        assert hashlib.sha256(payload).hexdigest() == part['sha256'], 'Evidence part hash mismatch'
        target.write(payload)
        joined.update(payload)
assert joined.hexdigest() == manifest['archive']['sha256'], 'Assembled archive hash mismatch'
(output / 'EVIDENCE.json').write_bytes(index_bytes)
shutil.copyfile(manifest_path, output / 'EVIDENCE-PARTS.json')
print(json.dumps({'archiveSha256': joined.hexdigest(), 'bytes': manifest['archive']['bytes'],
                  'parts': len(parts), 'output': str(output),
                  'next': 'Run verify-evidence.py on the copied EVIDENCE.json for payload verification.'}))
