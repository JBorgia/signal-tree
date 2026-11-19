from pathlib import Path
import json,hashlib,shutil
p=Path('/private/tmp/st-c17-value-work-correction');out=Path(__file__).parent;h=lambda b:hashlib.sha256(b).hexdigest()
for side,manifest in [('predecessor','BASE-C17.json'),('candidate','SNAPSHOT-VALUE-WORK.json')]:
 for n,digest in json.loads((p/manifest).read_text()).items():
  assert h((p/side/n).read_bytes())==digest,(side,n,'author')
  assert h((out/side/n).read_bytes())==digest,(side,n,'own')
original='packages/kernel/src/lib/scalar-frame-publication.spec.ts'
assert (out/'candidate'/original).read_bytes()==(Path('/private/tmp/st-native-combined-c15/candidate')/original).read_bytes()
e=out/'author-evidence';e.mkdir(exist_ok=True)
for f in p.iterdir():
 if f.is_file() and (f.suffix in ['.log','.json','.md','.patch'] or f.name in ['RUNTIME-FIRST-private.ts','TEST-FIRST.spec.ts']):shutil.copyfile(f,e/f.name)
files=[f for folder in [out/'runs',e] for f in folder.rglob('*') if f.is_file()]
files += [out/n for n in ['independent-value-work-controls.spec.ts','prepare.py','run.py','RUNTIME.patch','TESTS.patch','TEST-COMMENT.patch','IDENTITY.json','independent-value-work-getter.spec.ts','GETTER-FIRST.spec.ts','getter-later-stacks.json','comment-check.cjs','comment-check.log','REVIEW.md']]
(out/'EVIDENCE-SHA256.json').write_text(json.dumps({str(f.relative_to(out)):h(f.read_bytes()) for f in files},indent=2)+'\n')
print('Verified full author and own source identities post-run; original scalar frame file byte-identical to exact C15; all author first failures and final artifacts archived.')
