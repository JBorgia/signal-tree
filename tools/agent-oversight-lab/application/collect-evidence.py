"""Package explicitly selected public evidence; never crawl private Studio.

Usage: collect-evidence.py PLAN.json NEW_REPORT_DIRECTORY
The plan lists {source, destination} entries and excluded directory names and
suffixes. Absolute original paths remain provenance, not replay requirements.
"""
from datetime import datetime, timezone
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE; integrity assertions are required')


def sha(data):
    return hashlib.sha256(data).hexdigest()


plan_path, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
plan_bytes = plan_path.read_bytes()
plan = json.loads(plan_bytes)
public_root = Path(plan['publicRoot']).resolve()
assert public_root.name == 'signaltree'
assert not output.exists(), 'Preserve earlier evidence attempts'
assert output.is_relative_to(public_root)
excluded_dirs = set(plan['excludeDirectories'])
excluded_suffixes = tuple(plan['excludeSuffixes'])
files = {}
omissions = []


def add(path, name):
    assert path.is_file() and not path.is_symlink(), str(path)
    assert path.resolve().is_relative_to(public_root), str(path)
    assert 'signaltree-studio' not in str(path), str(path)
    target = PurePosixPath(name)
    assert not target.is_absolute() and '..' not in target.parts
    assert str(target) not in files, f'Duplicate destination: {target}'
    files[str(target)] = path


for entry in plan['entries']:
    source = Path(entry['source']).resolve()
    assert source.is_relative_to(public_root) and source.exists(), str(source)
    assert not output.is_relative_to(source), 'Cannot archive own output'
    if source.is_file():
        add(source, entry['destination'])
        continue
    for directory, dirs, names in os.walk(source, followlinks=False):
        base = Path(directory)
        for name in list(dirs):
            child = base / name
            if name in excluded_dirs or child.is_symlink():
                dirs.remove(name)
                omissions.append(str(child))
        for name in sorted(names):
            child = base / name
            if child.is_symlink() or name.endswith(excluded_suffixes):
                omissions.append(str(child))
                continue
            add(child, str(PurePosixPath(entry['destination']) / child.relative_to(source)))

output.mkdir(parents=True)
archive = output / 'evidence.tar.gz'
inventory = {}
with archive.open('xb') as raw:
    with gzip.GzipFile(fileobj=raw, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w|') as stream:
            for name, path in sorted(files.items()):
                payload = path.read_bytes()
                inventory[name] = {'sha256': sha(payload), 'bytes': len(payload),
                                   'original': str(path)}
                header = tarfile.TarInfo(name)
                header.size = len(payload)
                header.mode = 0o644
                header.mtime = 0
                stream.addfile(header, io.BytesIO(payload))

verified = 0
with tarfile.open(archive, 'r:gz') as stream:
    members = stream.getmembers()
    assert [item.name for item in members] == sorted(inventory)
    for item in members:
        assert item.isfile()
        payload = stream.extractfile(item).read()
        assert sha(payload) == inventory[item.name]['sha256']
        assert len(payload) == inventory[item.name]['bytes']
        # Detect inputs changed during packaging, rather than certifying a mix.
        assert sha(files[item.name].read_bytes()) == sha(payload)
        verified += 1

record = {
    'format': 'oversight-followthrough-evidence-v1',
    'createdUTC': datetime.now(timezone.utc).isoformat(),
    'command': [sys.executable, *sys.argv],
    'generatorSha256': sha(Path(__file__).read_bytes()),
    'planSha256': sha(plan_bytes),
    'archive': {'file': archive.name, 'sha256': sha(archive.read_bytes()),
                'verifiedPayloads': verified},
    'files': inventory,
    'excludedPaths': sorted(omissions),
    'limits': plan['limits'],
}
(output / 'EVIDENCE.json').write_text(json.dumps(record, indent=2) + '\n')
(output / 'COLLECTION-PLAN.json').write_bytes(plan_bytes)
print(json.dumps(record['archive']))
