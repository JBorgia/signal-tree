#!/usr/bin/env python3
"""Verify the recorded payload set without extracting archive-controlled paths."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile

archive = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('evidence.tar.gz')
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    by_name = {member.name: member for member in members}
    assert len(by_name) == len(members), 'Duplicate archive path'
    assert all(member.isfile() for member in members), 'Non-file archive entry'
    for name in by_name:
        path = PurePosixPath(name)
        assert not path.is_absolute() and '..' not in path.parts, 'Unsafe archive path'
    manifest = json.load(tar.extractfile(by_name['MANIFEST.json']))
    assert set(by_name) == set(manifest) | {'MANIFEST.json'}, 'Payload set differs'
    for name, expected in manifest.items():
        data = tar.extractfile(by_name[name]).read()
        assert len(data) == expected['bytes'], f'Size mismatch: {name}'
        assert hashlib.sha256(data).hexdigest() == expected['sha256'], f'Hash mismatch: {name}'
print(f'Verified {len(manifest)} payloads; repository history and signed authenticity are outside this check.')
