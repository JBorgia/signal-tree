"""Archive verified raw evidence without losing the original local payloads."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

report, retained_raw = map(Path, sys.argv[1:])
manifest_path = report / 'EVIDENCE.json'
manifest = json.loads(manifest_path.read_text())
raw = report / 'evidence'
archive = report / 'evidence.tar.gz'
assert not archive.exists() and not retained_raw.exists()
for name, entry in manifest['files'].items():
    assert hashlib.sha256((raw / name).read_bytes()).hexdigest() == entry['sha256'], name
with tarfile.open(archive, 'w:gz') as output:
    for name in sorted(manifest['files']):
        output.add(raw / name, arcname=name, recursive=False)
with tarfile.open(archive, 'r:gz') as packed:
    assert sorted(packed.getnames()) == sorted(manifest['files'])
    for item in packed.getmembers():
        assert item.isfile() and '..' not in Path(item.name).parts
        assert hashlib.sha256(packed.extractfile(item).read()).hexdigest() == manifest['files'][item.name]['sha256']
manifest['archive'] = {'file': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'verifiedPayloads': len(manifest['files'])}
manifest['packGenerator'] = {'path': str(Path(__file__).resolve()), 'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'command': [sys.executable, *sys.argv]}
raw.rename(retained_raw)
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest['archive']))
