#!/usr/bin/env python3
"""Verify every regular payload without extracting or executing the archive."""
import hashlib
import json
from pathlib import Path
import tarfile

directory = Path(__file__).resolve().parent
archive = directory / 'evidence.tar.gz'
expected = (directory / 'evidence.sha256').read_text().split()[0]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'archive hash'
with tarfile.open(archive, 'r:gz') as bundle:
    entries = bundle.getmembers()
    assert all(entry.isfile() for entry in entries), 'non-file archive member'
    names = [entry.name for entry in entries]
    assert len(names) == len(set(names)), 'duplicate archive member'
    manifest = json.load(bundle.extractfile('MANIFEST.json'))
    assert manifest and set(names) == set(manifest) | {'MANIFEST.json'}, 'inventory'
    for name, item in manifest.items():
        data = bundle.extractfile(name).read()
        assert len(data) == item['bytes'], name
        assert hashlib.sha256(data).hexdigest() == item['sha256'], name
print(f'Verified archive hash and {len(manifest)} file payloads.')
