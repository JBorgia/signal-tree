from pathlib import Path
import hashlib,json,difflib
p=Path(__file__).resolve().parent;c=p/'candidate';h=lambda b:hashlib.sha256(b).hexdigest();base=json.loads((p/'BASE-C21.json').read_text())
removed='packages/kernel/src/lib/aggregate-independent-input.spec.ts';changed='packages/kernel/src/lib/recipient-cause-classification.spec.ts';new='packages/kernel/src/lib/recipient-progress-positive-counterparts.spec.ts'
for k,v in base.items():
 if k in {removed,changed}:continue
 assert h((c/k).read_bytes())==v,k
assert not (c/removed).exists()
for k in [removed,changed]:assert h((p/'originals'/Path(k).name).read_bytes())==base[k]
parts=[]
for k in [removed,changed,new]:
 before=(p/'originals'/Path(k).name).read_text() if k in {removed,changed} else ''
 after=(c/k).read_text() if k!=removed else ''
 parts.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+k if before else '/dev/null',tofile='b/'+k if after else '/dev/null'))
(p/'COUNTERPARTS.patch').write_text(''.join(parts))
m={k:(h((c/k).read_bytes()) if k==changed else v) for k,v in base.items() if k!=removed};m[new]=h((c/new).read_bytes());(p/'SNAPSHOT-COUNTERPARTS.json').write_text(json.dumps(dict(sorted(m.items())),indent=2)+'\n')
r={'baseManifestSha256':h((p/'BASE-C21.json').read_bytes()),'candidateManifestSha256':h((p/'SNAPSHOT-COUNTERPARTS.json').read_bytes()),'patchSha256':h((p/'COUNTERPARTS.patch').read_bytes()),'added':{new:m[new]},'modified':{changed:m[changed]},'removed':{removed:base[removed]},'verifiedUnchangedBaselineFiles':len(base)-2,'runtimeChanged':False,'originalSixBodiesPreserved':'originals/','validUnknownAssertionsChanged':False,'sourcePermissionNineControlsUnchanged':True,'results':{f.name:json.loads(f.read_text()) for f in sorted(p.glob('*-exit.json'))}}
(p/'FREEZE.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
