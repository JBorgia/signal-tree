from pathlib import Path
import shutil,json,hashlib
r=Path('/private/tmp/st-c28-r3-disposition-index-review');src=Path('/private/tmp/st-c28-r3-disposition-index/candidate');m=json.loads((src.parent/'BASE-MANIFEST.json').read_text());m['packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts']=hashlib.sha256((src/'packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts').read_bytes()).hexdigest()
for f,v in m.items():
 p=src/f;assert hashlib.sha256(p.read_bytes()).hexdigest()==v
 q=r/'candidate'/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
(r/'candidate/node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(r/'CONTROL-BASE-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
s=(src.parent/'run-diagnostic.py').read_text().replace("b=Path('/private/tmp/st-c28-r3-disposition-index')","b=Path('/private/tmp/st-c28-r3-disposition-index-review')")
(r/'run-controls.py').write_text(s)
