"""Verify supplied public evidence without extracting or opening original paths."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE; integrity assertions are required')

index_path = Path(sys.argv[1]).resolve()
index = json.loads(index_path.read_text())
assert index['format'] == 'oversight-followthrough-evidence-v1'
assert index['archive']['file'] == 'evidence.tar.gz'
archive = index_path.parent / index['archive']['file']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == index['archive']['sha256']
expected = index['files']
assert expected
seen = set()
with tarfile.open(archive, 'r:gz') as stream:
    for member in stream:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert member.name not in seen and member.name in expected
        payload = stream.extractfile(member).read()
        assert len(payload) == expected[member.name]['bytes']
        assert hashlib.sha256(payload).hexdigest() == expected[member.name]['sha256']
        seen.add(member.name)
assert seen == set(expected)
assert len(seen) == index['archive']['verifiedPayloads']
print(json.dumps({'verifiedPayloads': len(seen), 'archiveSha256': index['archive']['sha256'],
                  'scope': 'Supplied file integrity; not full repository history or offline reproduction.'}))
