from pathlib import Path
import json,hashlib,shutil,os
r=Path(__file__).resolve().parent;s=Path('/private/tmp/st-c21-point-bounded-alternatives');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((s/'BASE-MANIFEST.json').read_text());arms={}
for label,mf in [('baseline','SNAPSHOT-baseline.json'),('A','SNAPSHOT-A.json')]:
 m=json.loads((s/mf).read_text());d=r/label;d.mkdir(exist_ok=False)
 for p,v in m.items():
  src=s/label/p;assert h(src)==v,p
  dst=d/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst);assert h(dst)==v,p
 os.symlink('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',d/'node_modules')
 arms[label]={'manifest':h(s/mf),'count':len(m),'changedFromC21':[p for p in base if base[p]!=m.get(p)],'added':sorted(m.keys()-base.keys())}
for f in ['BASE-MANIFEST.json','SNAPSHOT-A.json','SNAPSHOT-baseline.json','A-runtime.patch','research-tests.patch','FREEZE.json','REPORT.md','EXPECTATIONS.md','COUNT-COMPARISON.json','compare-counts.py','run.py','PRE-IMPLEMENTATION-FIXTURE-HASHES.json','FIRST-singleton-input-controls.spec.ts','FIRST-HISTOGRAM-NORMALIZATION-DIFF.json']:
 shutil.copyfile(s/f,r/f)
(r/'IDENTITY.json').write_text(json.dumps({'arms':arms,'files':{f:h(s/f) for f in ['FREEZE.json','A-runtime.patch','REPORT.md']}},indent=2)+'\n')
print(json.dumps(arms),flush=True)
