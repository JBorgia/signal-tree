#!/usr/bin/env python3
"""Verify the committed split bytes, standalone extraction, and failure controls."""
import datetime, hashlib, json, pathlib, shutil, subprocess, sys, tarfile, time

root = pathlib.Path(__file__).resolve().parent
study = pathlib.Path('/Users/jonathanborgia/code/signaltree/.worktrees/agent-collaboration-evaluation')
report = study / 'docs/audits/2026-11-11-agent-collaboration'
out = root / 'evidence-final-verification'
assert not out.exists()
out.mkdir()
sha = lambda p: hashlib.file_digest(p.open('rb'), 'sha256').hexdigest()
write = lambda p, data: p.write_text(json.dumps(data, indent=2) + '\n')
original = root / 'evidence-archive.tar.gz'
expected = (root / 'evidence-archive.tar.gz.sha256').read_text().split()[0]
assert sha(original) == expected
parts = []
with original.open('rb') as stream:
    while chunk := stream.read(90_000_000):
        target = report / f'evidence.tar.gz.part-{len(parts) + 1:03d}'
        with target.open('xb') as destination:
            destination.write(chunk)
        parts.append({'file': target.name, 'bytes': len(chunk), 'sha256': sha(target)})
reassembled = out / 'reassembled.tar.gz'
with reassembled.open('xb') as destination:
    for part in parts:
        target = report / part['file']
        assert sha(target) == part['sha256']
        with target.open('rb') as source:
            shutil.copyfileobj(source, destination)
assert reassembled.stat().st_size == original.stat().st_size
assert sha(reassembled) == expected
with tarfile.open(reassembled, 'r:gz') as archive:
    standalone = out / 'archive-evidence.py'
    standalone.write_bytes(archive.extractfile('archive-evidence.py').read())

runs = []
def run(label, args, code=0, error=None):
    log = out / (label + '.log')
    start = time.monotonic()
    with log.open('xb') as destination:
        result = subprocess.run(args, cwd=out, stdout=destination, stderr=subprocess.STDOUT)
    record = {'label': label, 'command': args, 'cwd': str(out), 'exitCode': result.returncode,
              'expectedExitCode': code, 'seconds': time.monotonic() - start,
              'log': log.name, 'logSha256': sha(log)}
    runs.append(record)
    write(out / 'progress.json', runs)
    print(json.dumps(record), flush=True)
    assert result.returncode == code, log.read_text()
    if error:
        assert error in log.read_text(), log.read_text()

extracted = out / 'extracted'
run('extract-and-verify', [sys.executable, str(standalone), 'extract', str(reassembled), str(extracted)])
manifest = json.loads((extracted / 'manifest.json').read_text())
bundled = extracted / 'archive-evidence.py'
assert sha(bundled) == manifest['verifierSha256'] == sha(standalone)
digest, payload = next((digest, payload) for digest, payload in manifest['payloads'].items() if 0 < payload['size'] < 4096)
target = extracted / payload['path']
original_payload = target.read_bytes()
try:
    target.write_bytes(bytes([original_payload[0] ^ 1]) + original_payload[1:])
    run('reject-tampered-payload', [sys.executable, str(bundled), 'verify', str(extracted)], 1, 'Payload checksum/size mismatch: ' + payload['path'])
    target.unlink()
    run('reject-missing-payload', [sys.executable, str(bundled), 'verify', str(extracted)], 1, 'No such file or directory')
finally:
    target.write_bytes(original_payload)
assert sha(target) == digest
run('restored-standalone-verification', [sys.executable, str(bundled), 'verify', str(extracted)])
result = {'format': 'signaltree-split-evidence-verification-v1',
          'completedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scriptSha256': sha(pathlib.Path(__file__)), 'archiveSha256': expected,
          'archiveBytes': original.stat().st_size, 'parts': parts,
          'manifestSha256': sha(extracted / 'manifest.json'),
          'verifierSha256': manifest['verifierSha256'],
          'counts': {'originalVersionMappings': len(manifest['entries']),
                     'uniquePayloads': len(manifest['payloads']),
                     'payloadBytes': sum(x['size'] for x in manifest['payloads'].values()),
                     'explicitSelections': len(manifest['selections']),
                     'opaqueMappings': sum(x['opaque'] for x in manifest['entries']),
                     'parsedJsonMappings': sum(x['parsedJson'] for x in manifest['entries'])},
          'controlledPayload': {'path': payload['path'], 'sha256': digest, 'bytes': payload['size']},
          'runs': runs, 'result': 'pass',
          'limits': 'Verifies supplied bytes and declared reference closure, not authenticity, semantic correctness, complete history or full installed-environment reproducibility. Original paths are identities; verification reads the supplied archive only.'}
write(out / 'result.json', result)
print(json.dumps({'result': 'pass', 'archiveSha256': expected, 'counts': result['counts']}), flush=True)
