from pathlib import Path
import json,hashlib,difflib
r=Path(__file__).parent;base=Path('/private/tmp/st-native-combined-b/candidate');cand=r/'candidate';m=json.loads((r/'PREDECESSOR.json').read_text());paths=set(m)
paths.update(str(p.relative_to(cand)) for p in (cand/'packages').rglob('*.ts') if 'node_modules' not in p.parts)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={f:sha(cand/f) for f in sorted(paths)};changed=[f for f,h in manifest.items() if m.get(f)!=h]
for kind,predicate in [('source',lambda f:not f.endswith('.spec.ts')),('tests',lambda f:f.endswith('.spec.ts'))]:
 diffs=[]
 for f in changed:
  if not predicate(f):continue
  old=(base/f).read_text() if (base/f).exists() else '';new=(cand/f).read_text()
  diffs.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+f,tofile='b/'+f))
 (r/(kind+'.patch')).write_text(''.join(diffs))
(r/'SOURCE-SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert not [f for f,h in m.items() if sha(base/f)!=h]
(r/'VERIFICATION.json').write_text(json.dumps({'predecessorUnchanged':True,'predecessorFiles':len(m),'candidateFiles':len(manifest),'changed':changed,'originalFixturesUnchanged':all(manifest[f]==m[f] for f in m if f.endswith(('native-compound-ordinary-order-regression.spec.ts','native-structural-composition-gates.spec.ts')))},indent=2)+'\n')
(r/'FREEZE.json').write_text(json.dumps({'candidate':str(cand),'predecessorManifestSha256':sha(Path('/private/tmp/st-native-combined-b/SNAPSHOT-B.json')),'sourceManifestSha256':sha(r/'SOURCE-SHA256.json'),'sourcePatchSha256':sha(r/'source.patch'),'testsPatchSha256':sha(r/'tests.patch'),'status':'frozen for different independent reviewer; not integrated'},indent=2)+'\n')
# Reconstruct the exact first implementation failure patch against unchanged B.
failure=r/'first-failures/final-adjacency';diffs=[]
for f in changed:
 old=(base/f).read_text() if (base/f).exists() else ''
 archived=failure/str(Path(f).relative_to('packages/kernel/src/lib'))
 new=archived.read_text() if archived.exists() else (cand/f).read_text()
 diffs.extend(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+f,tofile='b/'+f))
(failure/'source-and-tests.patch').write_text(''.join(diffs))
print((r/'FREEZE.json').read_text())
