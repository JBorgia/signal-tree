"""Check actual copied parts, then reject missing, corrupted and misordered parts.

Usage: assemble-evidence-controls.py EVIDENCE-PARTS.json NEW_OUTSIDE_DIRECTORY
"""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

manifest_path, output = map(lambda p: Path(p).resolve(), sys.argv[1:])
assert not output.exists()
root = Path('/Users/jonathanborgia/code/signaltree')
assert not output.is_relative_to(root)
source = manifest_path.parent
manifest = json.loads(manifest_path.read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
output.mkdir()
assembler = output / 'assemble-evidence.py'
verifier = output / 'verify-evidence.py'
here = Path(__file__).resolve().parent
shutil.copyfile(here / assembler.name, assembler)
shutil.copyfile(here.parent / 'agent-oversight-lab/application' / verifier.name, verifier)
assert sha(assembler) == manifest['assemblerSha256']
base = output / 'copied-parts'; base.mkdir()
for name in ['EVIDENCE.json', 'EVIDENCE-PARTS.json', *[p['file'] for p in manifest['parts']]]:
    shutil.copyfile(source / name, base / name)
guard = '''import os,runpy,sys
prefix=os.path.realpath(sys.argv[2])+os.sep
script=sys.argv[1];sys.argv=[script,*sys.argv[3:]]
def audit(event,args):
 if event=='open' and isinstance(args[0],(str,bytes,os.PathLike)):
  path=os.path.realpath(os.fsdecode(args[0]))
  if path.startswith(prefix):raise PermissionError('Original repository reads denied: '+path)
sys.addaudithook(audit);runpy.run_path(script,run_name='__main__')
'''
rows = []
def run(name, script, args, expected):
    command = [sys.executable, '-c', guard, str(script), str(root), *map(str, args)]
    p = subprocess.run(command, capture_output=True, text=True)
    log = p.stdout + p.stderr
    path = output / (name + '.log'); path.write_text(log)
    assert p.returncode == expected, log
    assert 'Original repository reads denied:' not in log, log
    rows.append({'name': name, 'command': command, 'exitCode': p.returncode, 'logSha256': sha(path)})
    return log
run('assemble-intact', assembler, [base/'EVIDENCE-PARTS.json', output/'joined'], 0)
run('verify-joined-payloads', verifier, [output/'joined/EVIDENCE.json'], 0)
for mode in ['missing', 'corrupt', 'reordered', 'wrong-index']:
    case = output / mode; case.mkdir()
    m = copy.deepcopy(manifest)
    for name in ['EVIDENCE.json', *[p['file'] for p in m['parts']]]:
        (case/name).hardlink_to(base/name)
    if mode == 'missing':
        (case/m['parts'][0]['file']).unlink()
    elif mode == 'corrupt':
        p = case/m['parts'][0]['file']; p.unlink(); shutil.copyfile(base/p.name,p)
        with p.open('r+b') as f:
            first=f.read(1);f.seek(0);f.write(bytes([first[0]^1]))
    elif mode == 'reordered':
        m['parts'].reverse()
        for i,p in enumerate(m['parts']):p['ordinal']=i
    else:
        m['index']['sha256']='0'*64
    (case/'EVIDENCE-PARTS.json').write_text(json.dumps(m,indent=2)+'\n')
    log = run('reject-'+mode,assembler,[case/'EVIDENCE-PARTS.json',output/(mode+'-joined')],1)
    assert {'missing':'Missing evidence part','corrupt':'Evidence part hash mismatch','reordered':'Assembled archive hash mismatch','wrong-index':'AssertionError'}[mode] in log
for part in manifest['parts']:
    assert sha(base/part['file']) == sha(source/part['file']) == part['sha256']
(output/'RESULTS.json').write_text(json.dumps({'passed':True,'sourceManifestSha256':sha(manifest_path),
    'sourceIndexSha256':sha(source/'EVIDENCE.json'),'archiveSha256':manifest['archive']['sha256'],
    'originalRepositoryReadsDenied':True,'sourcePartsUnchanged':True,'checks':rows,
    'sourceBindings':{str(p):sha(p) for p in [Path(__file__),here/'assemble-evidence.py',here.parent/'agent-oversight-lab/application/verify-evidence.py']}},indent=2)+'\n')
print(json.dumps({'passed':True,'positive':2,'negative':4,'output':str(output)}))
