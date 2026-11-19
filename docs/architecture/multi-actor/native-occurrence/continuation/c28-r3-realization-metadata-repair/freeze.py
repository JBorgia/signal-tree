from pathlib import Path
import hashlib,json,difflib
root=Path(__file__).parent;candidate=root/'candidate';base=json.loads((root/'BASE-MANIFEST.json').read_text());manifest={};changed=[];patch=[]
new=['packages/kernel/src/lib/internals/scalar-admission-metadata.ts','packages/kernel/src/lib/internals/realization-admission-metadata.spec.ts']
for f in list(base)+new:
 p=candidate/f;b=p.read_bytes();h=hashlib.sha256(b).hexdigest();manifest[f]=h
 if base.get(f)!=h:
  changed.append(f);before=(root/'baseline'/f).read_text() if f in base else ''
  patch.append((f,''.join(difflib.unified_diff(before.splitlines(True),b.decode().splitlines(True),fromfile='a/'+f if f in base else '/dev/null',tofile='b/'+f))))
assert len(changed)==12,changed
assert all('.spec.' not in f for f in changed if f in base)
for f,h in base.items():assert hashlib.sha256((root/'baseline'/f).read_bytes()).hexdigest()==h,f
(root/'MANIFEST.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
(root/'runtime.patch').write_text(''.join(s for f,s in patch if '.spec.' not in f))
(root/'tests.patch').write_text(''.join(s for f,s in patch if '.spec.' in f))
(root/'RUNTIME-MANIFEST.json').write_text(json.dumps({f:manifest[f] for f in changed if '.spec.' not in f},indent=2)+'\n')
(root/'MODES.json').write_text(json.dumps({f:oct((candidate/f).stat().st_mode&0o777) for f in manifest},indent=2)+'\n')
evidence={}
for p in root.rglob('*'):
 if not p.is_file() or p.is_symlink():continue
 rel=p.relative_to(root)
 if rel.parts[0] in ['candidate','baseline','node_modules','declarations','gate-declarations','prior-state-runs']:continue
 if any(x in rel.parts for x in ['cache','data','tmp']):continue
 if p.name in ['FREEZE.json','EVIDENCE.json']:continue
 evidence[str(rel)]=hashlib.sha256(p.read_bytes()).hexdigest()
(root/'EVIDENCE.json').write_text(json.dumps(evidence,indent=2,sort_keys=True)+'\n')
frozen={'status':'frozen for independent implementation review; no self-acceptance','baseManifest':hashlib.sha256((root/'BASE-MANIFEST.json').read_bytes()).hexdigest(),'baseFiles':len(base),'originalFixturesUnchanged':True,'changedPaths':changed,'sha256':{f:hashlib.sha256((root/f).read_bytes()).hexdigest() for f in ['MANIFEST.json','RUNTIME-MANIFEST.json','runtime.patch','tests.patch','MODES.json','REPORT.md','PRODUCERS.md','EVIDENCE.json']}}
(root/'FREEZE.json').write_text(json.dumps(frozen,indent=2)+'\n');print(json.dumps(frozen,indent=2))
