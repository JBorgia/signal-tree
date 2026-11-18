#!/usr/bin/env python3
"""Verify the exact archived file set and bytes; no extraction or execution."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE; integrity assertions are required')

index_path = Path(sys.argv[1]).resolve()
index = json.loads(index_path.read_text())
assert index['format'] == 'publication-activation-evidence-v1'
assert index['archive'] == 'observations.tar.gz'
archive = index_path.parent / index['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == index['archiveSha256']
expected = index['files']
assert expected
seen = set()
with tarfile.open(archive, 'r:gz') as tar:
    for member in tar:
        path = PurePosixPath(member.name)
        assert member.isfile() and not path.is_absolute() and '..' not in path.parts
        assert member.name not in seen and member.name in expected
        data = tar.extractfile(member).read()
        assert len(data) == expected[member.name]['bytes']
        assert hashlib.sha256(data).hexdigest() == expected[member.name]['sha256']
        seen.add(member.name)
assert seen == set(expected)
print(json.dumps({'verifiedFiles': len(seen), 'archiveSha256': index['archiveSha256'], 'scope': 'Supplied snapshot integrity; no claim of complete history or portable test reproduction.'}))
