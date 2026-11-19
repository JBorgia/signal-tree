from pathlib import Path
import json,hashlib,shutil
r=Path('/private/tmp/st-c28-r3-initialization-cleanup-review');p=Path('/private/tmp/st-c28-r3-initialization-cleanup-successor');m=json.loads((p/'MANIFEST.json').read_text());h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert h(p/'MANIFEST.json')=='e4ab440c101fbac6cc89f22924dba0842c3670ea519ac33087f62175c74e26e3'
for f,v in m.items():
 assert h(p/'candidate'/f)==v
 q=r/'candidate'/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/'candidate'/f,q)
(r/'candidate/node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(r/'SOURCE-MANIFEST.json').write_bytes((p/'MANIFEST.json').read_bytes())
s=Path('/private/tmp/st-c28-r3-disposition-index/run-diagnostic.py').read_text().replace("b=Path('/private/tmp/st-c28-r3-disposition-index')","b=Path('/private/tmp/st-c28-r3-initialization-cleanup-review')");(r/'run.py').write_text(s)
