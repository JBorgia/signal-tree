from pathlib import Path
import json,hashlib,datetime
p=Path(__file__).resolve().parent
checks=[]
for root,manifest in [('/private/tmp/st-v16-integration-candidate',p/'MANIFEST.json'),('/private/tmp/st-c28-r3-reader-test-composition/candidate',p/'BASE-MANIFEST.json'),('/private/tmp/st-v16-integration-evidence/dispatch-mutant',p/'MUTANT-MANIFEST.json')]:
 m=json.loads(manifest.read_text());bad=[]
 for n,h in m.items():
  f=Path(root)/n
  if not f.is_file() or hashlib.sha256(f.read_bytes()).hexdigest()!=h:bad.append(n)
 checks.append({'root':root,'filesChecked':len(m),'mismatches':bad,'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest()})
r={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':checks}
(p/'FINAL-SOURCE-CHECK.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));assert all(not v['mismatches'] for v in checks)
