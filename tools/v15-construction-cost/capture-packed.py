#!/usr/bin/env python3
"""Capture exact canonical prepare-only archives and join every shipped payload."""
import base64
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tarfile

candidate_arg, packages_arg, output_arg, expected_head = sys.argv[1:]
candidate, packages, output = map(lambda value: Path(value).resolve(), [candidate_arg, packages_arg, output_arg])
assert not output.exists(), 'Preserve existing evidence'
for source in [candidate, packages]:
    assert source != output and source not in output.parents and output not in source.parents
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
read = lambda path: json.loads(Path(path).read_text())
write = lambda path, value: Path(path).write_text(json.dumps(value, indent=2) + '\n')
inventory = lambda root: {str(path.relative_to(root)): sha(path) for path in sorted(root.rglob('*')) if path.is_file()}
journal = read(candidate / 'candidate.json')
names = ['kernel', 'angular', 'react', 'vue', 'solid']
assert journal['state'] == 'validated' and journal['commit'] == expected_head
assert [entry['package'] for entry in journal['packages']] == names
assert not any(path.name == '.npmrc' for path in candidate.rglob('*')), 'Prepare-only candidate must not include credentials'
output.mkdir()
canonical = output / 'canonical-candidate'
shutil.copytree(candidate, canonical)
assert inventory(candidate) == inventory(canonical)
packed = output / 'packages'; packed.mkdir()
records = {}
for entry in journal['packages']:
    name = entry['package']; built = read(packages / (name + '.json'))
    receipt = read(built['buildReceipt'])
    assert built['head'] == expected_head and sha(built['buildReceipt']) == built['buildReceiptSha256']
    assert receipt['head'] == expected_head and receipt['sourceUnchanged'] is True and receipt['exitCode'] == 0
    assert receipt['sourceSeal'] == built['sourceSeal']
    assert inventory(Path(built['root'])) == built['files']
    assert entry['name'] == '@signal-tree/' + name and entry['version'] == journal['version']
    relative = Path(entry['tarball'])
    assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] == 'tarballs'
    archive = canonical / relative
    assert entry['integrity'] == 'sha512-' + base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
    root = packed / name; root.mkdir(); files = {}
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar.getmembers():
            if member.isdir(): continue
            assert member.isfile() and member.name.startswith('package/')
            key = member.name.removeprefix('package/'); relative_file = Path(key)
            assert key and not relative_file.is_absolute() and '..' not in relative_file.parts and key not in files
            data = tar.extractfile(member).read(); files[key] = hashlib.sha256(data).hexdigest()
            destination = root / relative_file; destination.parent.mkdir(parents=True, exist_ok=True); destination.write_bytes(data)
    assert all(built['files'].get(key) == value for key, value in files.items())
    omitted = sorted(set(built['files']) - set(files))
    assert omitted == ([] if name == 'kernel' else ['dist/index.d.ts'])
    manifest = read(root / 'package.json')
    assert manifest['version'] == journal['version'] and manifest['name'] == entry['name']
    if omitted:
        assert manifest['exports']['.']['types'] == './src/index.d.ts'
        assert 'dist/**/*.d.ts' not in manifest['files'] and 'src/**/*.d.ts' in manifest['files']
    record = {**built, 'root': str(root), 'files': files, 'canonicalArchive': str(archive), 'canonicalArchiveSha256': sha(archive),
              'packingJournal': str(canonical / 'candidate.json'), 'packingJournalSha256': sha(canonical / 'candidate.json'),
              'excludedGeneratedFiles': omitted, 'limits': 'Exact canonical packed payloads from identified source/build. No publication.'}
    write(packed / (name + '.json'), record)
    records[name] = {'manifest': str(packed / (name + '.json')), 'manifestSha256': sha(packed / (name + '.json')),
                     'archive': str(archive), 'archiveSha256': sha(archive), 'payloads': len(files), 'omitted': omitted}
assert inventory(candidate) == inventory(canonical)
write(output / 'result.json', {'head': expected_head, 'records': records, 'everyShippedPayloadMatchesFreshBuild': True,
                              'publication': False, 'runnerSha256': sha(__file__), 'command': sys.argv})
print(json.dumps({'output': str(output), 'packages': len(records), 'shippedPayloads': sum(value['payloads'] for value in records.values())}))
