from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;s=Path('/private/tmp/st-native-combined-c11/candidate');manifest=Path('/private/tmp/st-native-combined-c11/SNAPSHOT-COUNTERPARTS.json');m=json.loads(manifest.read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for side in ['original','candidate']:
 for n,v in m.items():
  src=s/n;assert h(src)==v,n
  dst=p/side/n;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);assert h(dst)==v,n
 (p/side/'node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
shutil.copy2(manifest,p/'SNAPSHOT-C11-INPUT.json')
(p/'IDENTITY.json').write_text(json.dumps({'source':str(s),'manifest':str(manifest),'sha256':h(manifest),'files':len(m)},indent=2)+'\n')
print('verified two exact copies',len(m))
