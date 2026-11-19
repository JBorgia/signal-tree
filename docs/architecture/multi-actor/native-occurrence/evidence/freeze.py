from pathlib import Path
import json,hashlib,difflib,shutil
out=Path('/private/tmp/st-occurrence-successor-evidence');root=Path('/private/tmp/st-occurrence-successor');base=Path('/private/tmp/st-projection-certificate-successor')
sha=lambda data:hashlib.sha256(data).hexdigest()
previous=json.loads((out/'PREDECESSOR-SHA256.json').read_text())
for name,digest in previous.items():assert sha((base/name).read_bytes())==digest,name
names=set(previous)
for p in (root/'packages/kernel/src').rglob('*.ts'):names.add(str(p.relative_to(root)))
manifest={};changed=[];runtime=[];patch=[]
for name in sorted(names):
 data=(root/name).read_bytes();manifest[name]=sha(data);old=(base/name).read_bytes() if (base/name).exists() else b''
 if data==old:continue
 changed.append(name)
 text=''.join(difflib.unified_diff(old.decode().splitlines(True),data.decode().splitlines(True),fromfile='a/'+name if (base/name).exists() else '/dev/null',tofile='b/'+name))
 patch.append(text)
 if name.endswith('.ts') and not name.endswith('.spec.ts'):runtime.append(text)
 p=out/'source'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
(out/'source.patch').write_text(''.join(patch));(out/'runtime.patch').write_text(''.join(runtime));(out/'SOURCE-SHA256.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n')
identity={'baselineGit':'87ddcfdedcb5d91e700d812bd6cbee2f77038510','predecessor':str(base),'predecessorSourceManifestSha256':sha((out/'PREDECESSOR-SHA256.json').read_bytes()),'candidate':str(root),'sourceManifestSha256':sha((out/'SOURCE-SHA256.json').read_bytes()),'sourcePatchSha256':sha((out/'source.patch').read_bytes()),'runtimePatchSha256':sha((out/'runtime.patch').read_bytes()),'changedFiles':changed,'sourceFiles':len(manifest),'status':'frozen on covered restoration recurrence; independent review pending; no acceptance'}
(out/'IDENTITY.json').write_text(json.dumps(identity,indent=2)+'\n');print(json.dumps(identity,indent=2))
