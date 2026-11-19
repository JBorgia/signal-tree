from pathlib import Path
import json,hashlib,shutil
r=Path('/private/tmp/st-c28-r3-dynamic-admission-review/implementation');p=Path('/private/tmp/st-c28-r3-dynamic-admission-repair');m=json.loads((p/'MANIFEST.json').read_text());h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for f,v in m.items():
 assert h(p/'candidate'/f)==v
 q=r/'candidate'/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/'candidate'/f,q)
(r/'candidate/node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
s=Path('/private/tmp/st-c28-r3-disposition-index/run-diagnostic.py').read_text().replace("b=Path('/private/tmp/st-c28-r3-disposition-index')","b=Path('/private/tmp/st-c28-r3-dynamic-admission-review/implementation')");(r/'run.py').write_text(s)
(r/'REPLAY-BASE-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
