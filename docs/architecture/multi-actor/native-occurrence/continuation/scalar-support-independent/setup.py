from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;author=Path('/private/tmp/st-c12-scalar-support-correction');freeze=json.loads((author/'FREEZE.json').read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert h(author/'SNAPSHOT-SCALAR.json')==freeze['manifestSha256']=='d0b54e145b88a38015b3176000e0a8c23b74ebdc33be6f8eab0c122f2fb4b812'
for n,v in freeze['patches'].items():assert h(author/n)==v,n
for side,source,manifest in [('candidate',author/'candidate',author/'SNAPSHOT-SCALAR.json'),('oracle',Path('/private/tmp/st-native-combined-c12/candidate'),Path('/private/tmp/st-native-combined-c12/SNAPSHOT-C12.json'))]:
 m=json.loads(manifest.read_text());shutil.copy2(manifest,p/(side+'-MANIFEST.json'))
 for n,v in m.items():
  src=source/n;assert h(src)==v,(side,n)
  dest=p/side/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest)
 (p/side/'node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
 print(side,'verified',len(m),flush=True)
for n in ['FREEZE.json','RESULTS.md','RUNTIME.patch','TESTS.patch','FROM-C12.patch','candidate-new-first.log','RUNTIME-FIRST-private.ts']:
 shutil.copy2(author/n,p/n)
for n in ['scalar-native-support.spec.ts','parent-proof-safety-falsifier.spec.ts']:
 rel=Path('packages/kernel/src/lib')/n;shutil.copy2(p/'candidate'/rel,p/'oracle'/rel)
assert (p/'candidate/packages/kernel/src/lib/parent-proof-safety-falsifier.spec.ts').read_bytes()==Path('/private/tmp/st-native-parent-invalidation-review/SAFETY-FIRST.spec.ts').read_bytes()
shutil.copy2('/private/tmp/st-parent-freshness-implementation-independent/c11-test-reconciliation/run.py',p/'run.py')
assert h(author/'SNAPSHOT-SCALAR.json')==freeze['manifestSha256'];assert (author/'FREEZE.json').read_bytes()==(p/'FREEZE.json').read_bytes()
print('freeze unchanged after acquisition')
