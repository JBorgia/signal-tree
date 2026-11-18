#!/usr/bin/env python3
"""Compare two bound five-package builds; report every changed payload."""
from pathlib import Path
import hashlib
import json
import sys

if not __debug__:
    raise RuntimeError('Integrity assertions require ordinary Python execution')
before, after, output = (Path(value).resolve() for value in sys.argv[1:])
assert not output.exists()
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
read = lambda path: json.loads(Path(path).read_text())
records = []
for name in ['kernel', 'angular', 'react', 'vue', 'solid']:
    sides = []
    for directory in [before, after]:
        path = directory / (name + '.json')
        manifest = read(path)
        root = Path(manifest['root'])
        files = {str(p.relative_to(root)): sha(p) for p in root.rglob('*') if p.is_file()}
        assert files and files == manifest['files']
        assert sha(manifest['buildReceipt']) == manifest['buildReceiptSha256']
        receipt = read(manifest['buildReceipt'])
        assert receipt['sourceUnchanged'] is True and receipt['exitCode'] == 0
        assert receipt['head'] == manifest['head'] and receipt['sourceSeal'] == manifest['sourceSeal']
        sides.append({'manifest': str(path), 'manifestSha256': sha(path), 'head': manifest['head'],
                      'sourceSeal': manifest['sourceSeal'], 'files': files,
                      'totalBytes': sum((root / f).stat().st_size for f in files)})
    a, b = sides
    removed = sorted(set(a['files']) - set(b['files']))
    added = sorted(set(b['files']) - set(a['files']))
    changed = sorted(f for f in set(a['files']) & set(b['files']) if a['files'][f] != b['files'][f])
    differences = removed + added + changed
    records.append({'package': name, 'before': a, 'after': b, 'removed': removed, 'added': added,
                    'changed': changed, 'deltaBytes': b['totalBytes'] - a['totalBytes'],
                    'identicalJavascript': not any(f.endswith('.js') for f in differences),
                    'identicalDeclarations': not any(f.endswith('.d.ts') for f in differences),
                    'identicalAllPayloads': not differences})
output.write_text(json.dumps({'command': sys.argv, 'runnerSha256': sha(__file__), 'packages': records,
    'limits': 'Bound built payload comparison. Tarball packaging and public consumer behavior are separate checks.'}, indent=2) + '\n')
print(json.dumps([{'package': r['package'], 'identicalAllPayloads': r['identicalAllPayloads'],
    'deltaBytes': r['deltaBytes'], 'added': r['added'], 'removed': r['removed'], 'changed': r['changed']} for r in records], indent=2))
