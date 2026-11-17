#!/usr/bin/env python3
"""Continue after a wrong expected diagnostic in the first control driver."""
import datetime, hashlib, json, pathlib, subprocess, sys, time

root = pathlib.Path(__file__).resolve().parent
out = root / 'evidence-final-verification'
report = pathlib.Path('/Users/jonathanborgia/code/signaltree/.worktrees/agent-collaboration-evaluation/docs/audits/2026-11-11-agent-collaboration')
sha = lambda p: hashlib.file_digest(p.open('rb'), 'sha256').hexdigest()
write = lambda p, data: p.write_text(json.dumps(data, indent=2) + '\n')
first = json.loads((root / 'evidence-final-verification-command/receipt.json').read_text())
assert first['exitCode'] == 1
runs = json.loads((out / 'progress.json').read_text())
assert [x['exitCode'] for x in runs] == [0, 1, 1]
for record in runs:
    assert sha(out / record['log']) == record['logSha256']
assert 'Missing archived file:' in (out / 'reject-missing-payload.log').read_text()
extracted = out / 'extracted'
manifest = json.loads((extracted / 'manifest.json').read_text())
digest, payload = next((d, p) for d, p in manifest['payloads'].items() if 0 < p['size'] < 4096)
target = extracted / payload['path']
assert sha(target) == digest
original = target.read_bytes()
def run(label, code, expected_text):
    command = [sys.executable, str(extracted / 'archive-evidence.py'), 'verify', str(extracted)]
    log = out / (label + '.log')
    start = time.monotonic()
    with log.open('xb') as stream:
        result = subprocess.run(command, cwd=out, stdout=stream, stderr=subprocess.STDOUT)
    record = {'label': label, 'command': command, 'cwd': str(out), 'exitCode': result.returncode,
              'expectedExitCode': code, 'seconds': time.monotonic() - start,
              'log': log.name, 'logSha256': sha(log)}
    runs.append(record)
    write(out / 'progress-resumed.json', runs)
    print(json.dumps(record), flush=True)
    assert result.returncode == code and expected_text in log.read_text(), log.read_text()
try:
    target.unlink()
    run('reject-missing-payload-corrected-diagnostic', 1, 'Missing archived file: ' + payload['path'])
finally:
    target.write_bytes(original)
assert sha(target) == digest
run('restored-standalone-verification', 0, 'Verified ')
archive = out / 'reassembled.tar.gz'
expected = (root / 'evidence-archive.tar.gz.sha256').read_text().split()[0]
assert sha(archive) == expected
parts = [{'file': p.name, 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in sorted(report.glob('evidence.tar.gz.part-*'))]
aggregate = hashlib.sha256()
for part in parts:
    with (report / part['file']).open('rb') as stream:
        while chunk := stream.read(1024 * 1024): aggregate.update(chunk)
assert aggregate.hexdigest() == expected
assert sum(p['bytes'] for p in parts) == archive.stat().st_size
result = {'format': 'signaltree-split-evidence-verification-v1',
          'completedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'scripts': {name: sha(root / name) for name in ['verify-final-archive.py', 'complete-archive-verification.py']},
          'archiveSha256': expected, 'archiveBytes': archive.stat().st_size, 'parts': parts,
          'manifestSha256': sha(extracted / 'manifest.json'), 'verifierSha256': manifest['verifierSha256'],
          'counts': {'originalVersionMappings': len(manifest['entries']), 'uniquePayloads': len(manifest['payloads']),
                     'payloadBytes': sum(p['size'] for p in manifest['payloads'].values()),
                     'explicitSelections': len(manifest['selections']),
                     'opaqueMappings': sum(x['opaque'] for x in manifest['entries']),
                     'parsedJsonMappings': sum(x['parsedJson'] for x in manifest['entries'])},
          'controlledPayload': {'path': payload['path'], 'sha256': digest, 'bytes': payload['size']},
          'runs': runs, 'result': 'pass',
          'firstDriverFailure': 'The missing-payload control correctly exited 1, but the first driver expected an OS diagnostic instead of the verifier diagnostic Missing archived file. The original driver, log and receipt are preserved; the corrected expectation and restored positive check pass. No archive or verifier change.',
          'limits': 'Verifies supplied bytes and declared reference closure, not authenticity, semantic correctness, complete history or full installed-environment reproducibility. Original paths are identities; verification reads the supplied archive only.'}
write(out / 'result.json', result)
print(json.dumps({'result': 'pass', 'archiveSha256': expected, 'counts': result['counts']}), flush=True)
