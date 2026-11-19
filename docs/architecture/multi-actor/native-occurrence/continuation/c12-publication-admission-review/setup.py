from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;s=Path('/private/tmp/st-native-combined-c12');m=json.loads((s/'SNAPSHOT-C12.json').read_text());assert hashlib.sha256((s/'SNAPSHOT-C12.json').read_bytes()).hexdigest()=='d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2'
for n,d in m.items():
 f=s/'candidate'/n;assert hashlib.sha256(f.read_bytes()).hexdigest()==d,n
 out=p/'candidate'/n;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out)
(p/'BASE-MANIFEST.json').write_text(json.dumps(m,indent=2));(p/'candidate/node_modules').symlink_to('/private/tmp/st-c12-independent-framework-verification/candidate/node_modules')
r=Path('/private/tmp/st-absent-collection-introduction/probe-c8a/run-gate.py').read_text().replace("env.pop('NODE_PATH',None)","env.pop('NODE_PATH',None);env.pop('ST_PREPARED_REVIEW_OUTPUT',None)")
(p/'run.py').write_text(r)
print('all C12 files verified',len(m))
