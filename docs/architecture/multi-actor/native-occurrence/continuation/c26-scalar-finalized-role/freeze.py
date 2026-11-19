from pathlib import Path
import json,hashlib,difflib,shutil
r=Path('/private/tmp/st-c26-scalar-finalized-role');c=r/'candidate';b=Path('/private/tmp/st-c25-equal-owner/candidate');m=json.loads((r/'BASE-MANIFEST.json').read_text());patch=''
for saved in (r/'research/uninstrumented').rglob('*.ts'):
 rel=Path('packages/kernel/src')/saved.relative_to(r/'research/uninstrumented');p=c/rel
 patch+=''.join(difflib.unified_diff(saved.read_text().splitlines(True),p.read_text().splitlines(True),fromfile='a/'+str(rel),tofile='b/'+str(rel)))
 p.write_bytes(saved.read_bytes())
for name in ['scalar-finalized-derived-roots.spec.ts','scalar-finalized-lifecycle.spec.ts']:
 p=c/'packages/kernel/src/lib'/name;s=p.read_text();patch+=''.join(difflib.unified_diff([],s.splitlines(True),fromfile='/dev/null',tofile='b/packages/kernel/src/lib/'+name));shutil.copy2(p,r/'research'/name);p.unlink()
(r/'research/first-gate-instrumentation.patch').write_text(patch)
runtime='';changed=[]
for rel in m:
 p=c/rel
 if hashlib.sha256(p.read_bytes()).hexdigest()!=m[rel]:
  changed.append(rel);runtime+=''.join(difflib.unified_diff((b/rel).read_text().splitlines(True),p.read_text().splitlines(True),fromfile='a/'+rel,tofile='b/'+rel))
(r/'runtime.patch').write_text(runtime)
actual={rel:hashlib.sha256((c/rel).read_bytes()).hexdigest() for rel in m}
(r/'SNAPSHOT-C26.json').write_text(json.dumps(actual,indent=2)+'\n')
assert all(hashlib.sha256((b/rel).read_bytes()).hexdigest()==h for rel,h in m.items())
(r/'FREEZE.json').write_text(json.dumps({'status':'Frozen scalar-only prototype; independent review and unchanged focused replay pending','base':'9f3622a1231437c7f9cb732a1d2b3d0aa501ba45feee0c7a051f1e282b458f02','manifest':hashlib.sha256((r/'SNAPSHOT-C26.json').read_bytes()).hexdigest(),'runtimePatch':hashlib.sha256((r/'runtime.patch').read_bytes()).hexdigest(),'instrumentationPatch':hashlib.sha256((r/'research/first-gate-instrumentation.patch').read_bytes()).hexdigest(),'changed':changed,'C25Unchanged':True,'firstGate':'7 tests pass; roots did not yet include retirement-summary weak edges','firstGateComplete':'8 tests pass; adds no-recipient disposal; root graph includes retirement summary','sourceEditsClosed':True},indent=2)+'\n')
print((r/'FREEZE.json').read_text())
