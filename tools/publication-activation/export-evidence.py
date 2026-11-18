#!/usr/bin/env python3
"""Archive this study's pre-reviewed observations, payloads and receipts.

SOURCE OUTPUT. Does not fetch or substitute external paths named by receipts.
The archive establishes supplied-file integrity, not portable reproduction.
"""
from pathlib import Path
import gzip
import hashlib
import io
import json
import subprocess
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE; integrity assertions are required')

source, output = (Path(value).resolve() for value in sys.argv[1:])
assert source.is_dir() and not output.exists() and source not in output.parents
files = {}
for path in sorted(source.rglob('*')):
    assert not path.is_symlink(), path
    if path.is_dir():
        continue
    assert path.is_file(), path
    relative = str(path.relative_to(source))
    assert relative not in files
    data = path.read_bytes()
    files[relative] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
assert files
output.mkdir(parents=True)
archive = output / 'observations.tar.gz'
with archive.open('xb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as compressed:
    with tarfile.open(fileobj=compressed, mode='w|') as tar:
        for relative, entry in files.items():
            data = (source / relative).read_bytes()
            assert hashlib.sha256(data).hexdigest() == entry['sha256']
            info = tarfile.TarInfo(relative)
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            tar.addfile(info, io.BytesIO(data))
index = {
    'format': 'publication-activation-evidence-v1',
    'originalRoot': str(source),
    'archive': archive.name,
    'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
    'files': files,
    'exporterSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'limits': 'Integrity of supplied task evidence only. Absolute external paths in receipts identify the original source/toolchain, not files implicitly included in this archive. Git history, Node, peer installations, browser binaries and the full emitted demo are not bundled. Retained demo hashes identify the reviewed artifact; rerunning requires the pinned toolchain and dependencies. Numerical gate failures remain failures.',
}
(output / 'index.json').write_text(json.dumps(index, indent=2) + '\n')
subprocess.run([sys.executable, str(Path(__file__).with_name('verify-evidence.py')), str(output / 'index.json')], check=True)
