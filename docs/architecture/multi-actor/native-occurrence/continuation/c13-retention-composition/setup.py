from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;s=Path('/private/tmp/st-native-combined-c13/candidate');f=s.parent/'SNAPSHOT-C13.json';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert h(f)=='0efc2a195ab9cc2a49ba72da60c9c3b95b67f181861fb0b059f54340f66e3fcb'
m=json.loads(f.read_text());shutil.copy2(f,p/'BASE-SNAPSHOT.json')
for n,v in m.items():
 src=s/n;assert h(src)==v,n
 dst=p/'candidate'/n;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);assert h(dst)==v,n
(p/'candidate/node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
(p/'bin').mkdir();shutil.copy2('/private/tmp/st-test-routing-successor/bin/npx',p/'bin/npx');shutil.copy2('/private/tmp/st-test-routing-successor/gate.py',p/'gate.py')
shutil.copy2('/private/tmp/st-c12-occupancy-review/READINESS-FIXTURE.patch',p/'READINESS-FIXTURE.patch')
(p/'IDENTITY.json').write_text(json.dumps({'input':str(f),'sha256':h(f),'files':len(m),'node':'24.15.0','pnpm':'10.17.0','dependencyRoot':str((p/'candidate/node_modules').resolve()),'lockSha256':h(p/'candidate/pnpm-lock.yaml')},indent=2)+'\n')
print('exact C13 copy verified',len(m),flush=True)
