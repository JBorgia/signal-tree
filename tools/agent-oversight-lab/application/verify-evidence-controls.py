"""Verify isolated copies, then reject corrupted and missing payloads.

Original repository reads are denied during each verifier invocation. Corrupt
copies receive a corrected container hash, so controls exercise payload checks.
"""
import copy
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

if not __debug__:
    raise RuntimeError('Run without -O/PYTHONOPTIMIZE')

index_path, output = map(lambda value: Path(value).resolve(), sys.argv[1:])
assert not output.exists()
index = json.loads(index_path.read_text())
plan = json.loads((index_path.parent / 'COLLECTION-PLAN.json').read_text())
source = index_path.parent / index['archive']['file']
verifier = Path(__file__).with_name('verify-evidence.py')
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
assert sha(source) == index['archive']['sha256']
original_sha = sha(source)
output.mkdir()
copied_verifier = output / verifier.name
shutil.copyfile(verifier, copied_verifier)
guard = '''import os,runpy,sys
prefix=os.path.realpath(sys.argv[3])+os.sep
def audit(event,args):
 if event=='open' and isinstance(args[0],(str,bytes,os.PathLike)):
  path=os.path.realpath(os.fsdecode(args[0]))
  if path.startswith(prefix):raise PermissionError('Original repository reads denied: '+path)
script,index=sys.argv[1:3]
sys.argv=[script,index]
sys.addaudithook(audit)
runpy.run_path(script,run_name='__main__')
'''
results = []
for mode in ['intact', 'corrupt-payload', 'missing-payload', 'intact-after-controls']:
    case = output / mode
    case.mkdir()
    archive = case / 'evidence.tar.gz'
    copied = copy.deepcopy(index)
    victim = None
    if mode.startswith('intact'):
        shutil.copyfile(source, archive)
    else:
        with tarfile.open(source, 'r:gz') as before, tarfile.open(archive, 'w:gz') as after:
            for member in before:
                payload = before.extractfile(member).read()
                if victim is None and payload:
                    victim = member.name
                    if mode == 'missing-payload':
                        continue
                    payload = bytes([payload[0] ^ 1]) + payload[1:]
                after.addfile(member, io.BytesIO(payload))
        assert victim
        copied['archive']['sha256'] = sha(archive)
    copied_index = case / 'EVIDENCE.json'
    copied_index.write_text(json.dumps(copied, indent=2) + '\n')
    command = [sys.executable, '-c', guard, str(copied_verifier),
               str(copied_index), plan['publicRoot']]
    run = subprocess.run(command, capture_output=True, text=True)
    log = run.stdout + run.stderr
    (case / 'verify.log').write_text(log)
    expected = 0 if mode.startswith('intact') else 1
    row = {'mode': mode, 'exitCode': run.returncode, 'expectedExitCode': expected,
           'victim': victim, 'logSha256': sha(case / 'verify.log')}
    results.append(row)
    assert run.returncode == expected, log
    assert 'Original repository reads denied:' not in log, log
    if mode == 'corrupt-payload':
        assert 'AssertionError' in log and 'hashlib.sha256(payload)' in log
    elif mode == 'missing-payload':
        assert 'AssertionError' in log and 'seen == set(expected)' in log
    else:
        assert json.loads(run.stdout)['verifiedPayloads'] == len(index['files'])
    print(json.dumps(row), flush=True)
assert sha(source) == original_sha
(output / 'VERIFICATION.json').write_text(json.dumps({
    'archiveSha256': original_sha, 'indexSha256': sha(index_path),
    'generatorSha256': sha(__file__), 'verifierSha256': sha(verifier),
    'command': [sys.executable, *sys.argv], 'originalRepositoryReadsDenied': True,
    'containerHashesRecomputedForPayloadControls': True,
    'originalArchiveUnchanged': True, 'results': results,
}, indent=2) + '\n')
