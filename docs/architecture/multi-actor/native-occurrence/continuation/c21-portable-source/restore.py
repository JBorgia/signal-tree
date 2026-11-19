"""Restore the frozen source subset into an absent/empty directory; no tmp inputs."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import sys
import tarfile

here = Path(__file__).resolve().parent
manifest = json.loads((here / 'SCOPED-MANIFEST.json').read_text())
modes = json.loads((here / 'SCOPED-MODES.json').read_text())
identity = json.loads((here / 'IDENTITY.json').read_text())
archive = here / 'source.tar.gz'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == identity['archiveSha256']
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 restore.py EMPTY_DESTINATION')
dest = Path(sys.argv[1]).absolute()
if dest.is_symlink() or (dest.exists() and (not dest.is_dir() or any(dest.iterdir()))):
    raise SystemExit('Destination must be absent or an empty real directory')
# Validate all source members before writing. Do not use tar extraction.
with tarfile.open(archive, 'r:gz') as source:
    members = source.getmembers()
    assert len(members) == len(manifest)
    assert {m.name for m in members} == set(manifest)
    for member in members:
        path = PurePosixPath(member.name)
        assert not path.is_absolute() and '..' not in path.parts and member.isfile()
        assert not modes[member.name]['symlink']
        assert member.mode == int(modes[member.name]['mode'], 8)
        assert hashlib.sha256(source.extractfile(member).read()).hexdigest() == manifest[member.name]
    dest.mkdir(parents=True, exist_ok=True)
    for member in members:
        path = dest / member.name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('xb') as output:
            output.write(source.extractfile(member).read())
        os.chmod(path, member.mode)
for name, digest in manifest.items():
    path = dest / name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
    assert path.stat().st_mode & 0o777 == int(modes[name]['mode'], 8)
# The separate configured-demo asset supplement preserves the original source pack.
supplement = json.loads((here / 'ASSET-SUPPLEMENT.json').read_text())
asset_archive = here / 'demo-assets.tar.gz'
assert hashlib.sha256(asset_archive.read_bytes()).hexdigest() == supplement['sha256']
assets = {entry['path']: entry for entry in supplement['entries']}
with tarfile.open(asset_archive, 'r:gz') as source:
    members = source.getmembers()
    assert len(members) == len(assets) and {m.name for m in members} == set(assets)
    for member in members:
        path = PurePosixPath(member.name)
        assert not path.is_absolute() and '..' not in path.parts and member.isfile()
        entry = assets[member.name]
        data = source.extractfile(member).read()
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        assert member.mode == int(entry['mode'], 8)
        target = dest / member.name
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            output.write(data)
        os.chmod(target, member.mode)
print(json.dumps({'verifiedFiles': len(manifest), 'verifiedDemoAssets': len(assets), 'destination': str(dest),
                  'archiveSha256': identity['archiveSha256']}))
