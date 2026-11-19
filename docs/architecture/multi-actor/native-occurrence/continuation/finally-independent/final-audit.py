from pathlib import Path
import hashlib,json,shutil
p=Path('/private/tmp/st-c14-finally-successor'); out=Path(__file__).parent; h=lambda b:hashlib.sha256(b).hexdigest()
for side,manifest in [('predecessor','INPUT-SNAPSHOT.json'),('candidate','SNAPSHOT.json')]:
 m=json.loads((p/manifest).read_text())
 for name,digest in m.items():
  assert h((p/side/name).read_bytes())==digest,(side,name,'author')
  assert h((out/side/name).read_bytes())==digest,(side,name,'own')
for group in ['predecessor-precedence','successor-precedence','affected-lint','source-types','spec-types','scalar-composition']:
 for f in (p/'runs'/group).iterdir():
  if f.is_file():
   dest=out/'author-evidence'/group/f.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,dest)
files=[f for folder in [out/'runs',out/'author-evidence'] for f in folder.rglob('*') if f.is_file()]
files += [out/n for n in ['independent-finally-controls.spec.ts','prepare.py','run.py','PREWRITTEN-MATRIX.md','RUNTIME.patch','FROM-LINT-PREDECESSOR.patch','FREEZE.json']]
(out/'EVIDENCE-SHA256.json').write_text(json.dumps({str(f.relative_to(out)):h(f.read_bytes()) for f in files},indent=2)+'\n')
print('Post-run author and own source manifests verified; raw evidence archived and hashed.')
