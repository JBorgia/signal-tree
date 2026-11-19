from pathlib import Path
import subprocess,hashlib,json,difflib,shutil
base=Path('/private/tmp/link-collection-proof-successor')
root=Path('/private/tmp/st-projection-certificate-successor')
out=Path('/private/tmp/st-native-certificate-evidence')
sha=lambda data:hashlib.sha256(data).hexdigest()
files=subprocess.check_output(['git','ls-files','-z'],cwd=base).decode().split('\0')
changed=[];manifest={};patch=[];runtime=[]
for name in sorted(filter(None,files)):
 p=root/name
 if not p.is_file():continue
 data=p.read_bytes();manifest[name]=sha(data)
 old=(base/name).read_bytes()
 if data!=old:
  changed.append(name)
  diff=''.join(difflib.unified_diff(old.decode().splitlines(True),data.decode().splitlines(True),fromfile='a/'+name,tofile='b/'+name))
  patch.append(diff)
  if name.endswith('.ts') and not name.endswith('.spec.ts'):runtime.append(diff)
new='packages/kernel/src/lib/native-certificate-successor.spec.ts'
data=(root/new).read_bytes();manifest[new]=sha(data);changed.append(new)
patch.append(''.join(difflib.unified_diff([],data.decode().splitlines(True),fromfile='/dev/null',tofile='b/'+new)))
(out/'source.patch').write_text(''.join(patch));(out/'runtime.patch').write_text(''.join(runtime))
for name in changed:
 p=out/'source'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,p)
originals=['packages/kernel/src/lib/'+name for name in ['core-independent-review.spec.ts','collection-contributor-core.spec.ts','publication-terminal-consumer-independent.spec.ts']]
for name in originals:
 assert (root/name).read_bytes()==(base/name).read_bytes(),name
 p=out/'unchanged-fixtures'/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,p)
(out/'SOURCE-SHA256.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n')
identity={'baseline':'87ddcfdedcb5d91e700d812bd6cbee2f77038510','scratch':str(root),'sourceManifestSha256':sha((out/'SOURCE-SHA256.json').read_bytes()),'runtimePatchSha256':sha((out/'runtime.patch').read_bytes()),'sourcePatchSha256':sha((out/'source.patch').read_bytes()),'changedFiles':changed,'unchangedOriginalFixtures':{name:manifest[name] for name in originals},'status':'frozen after covered ancestor-omission recurrence; not accepted'}
(out/'IDENTITY.json').write_text(json.dumps(identity,indent=2)+'\n');print(json.dumps(identity,indent=2))
