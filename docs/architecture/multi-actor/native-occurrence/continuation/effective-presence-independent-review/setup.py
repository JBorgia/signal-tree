from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;s=Path('/private/tmp/st-effective-presence-successor');m=json.loads((s/'SNAPSHOT.json').read_text());base=json.loads((s/'BASE-SNAPSHOT.json').read_text())
h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert h(s/'SNAPSHOT.json')==json.loads((s/'FREEZE.json').read_text())['manifestSha256']
for name,digest in m.items():
 f=s/'candidate'/name;assert h(f)==digest,name
 out=p/'candidate'/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out)
(p/'BASE-MANIFEST.json').write_text(json.dumps(m,indent=2))
(p/'AUTHOR-FREEZE.json').write_bytes((s/'FREEZE.json').read_bytes())
(p/'BASELINE-MANIFEST.json').write_text(json.dumps(base,indent=2))
old=Path('/private/tmp/st-dormant-publication-feasibility/candidate/node_modules');deps=p/'candidate/node_modules';deps.mkdir()
for f in old.iterdir():
 if f.name in {'.bin','.cache','.vite'}:continue
 (deps/f.name).symlink_to(f.resolve())
shutil.copytree(old/'.bin',deps/'.bin',symlinks=False)
for f in (deps/'.bin').iterdir():
 try:t=f.read_text()
 except UnicodeError:continue
 f.write_text(t.replace(str(old),str(deps)))
r=Path('/private/tmp/st-absent-collection-introduction/probe-c8a/run-gate.py').read_text()
r=r.replace("env.pop('NODE_PATH',None)","env.pop('NODE_PATH',None);env.pop('ST_PREPARED_REVIEW_OUTPUT',None)")
(p/'run.py').write_text(r)
(p/'VERIFIED-INPUT.json').write_text(json.dumps({'manifest':h(s/'SNAPSHOT.json'),'files':len(m),'delta':[n for n in m if m[n]!=base.get(n)]},indent=2))
print('verified',len(m),flush=True)
