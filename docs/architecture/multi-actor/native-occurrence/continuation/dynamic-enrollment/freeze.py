from pathlib import Path
import json,hashlib,difflib,tarfile,shutil
r=Path(__file__).parent;c=r/'candidate';b=r/'baseline/candidate'
base=json.loads((r/'SOURCE-SHA256.json').read_text())
shutil.copy2(r/'SOURCE-SHA256.json',r/'PREDECESSOR-SNAPSHOT-C0.json')
paths=sorted(set(base)|{'packages/kernel/src/lib/dynamic-member-enrollment.spec.ts'})
m={p:hashlib.sha256((c/p).read_bytes()).hexdigest() for p in paths}
changed={p:h for p,h in m.items() if base.get(p)!=h}
runtime=[];tests=[]
for p in changed:
 old=(b/p).read_text().splitlines(keepends=True) if (b/p).is_file() else []
 new=(c/p).read_text().splitlines(keepends=True)
 diff=''.join(difflib.unified_diff(old,new,fromfile='a/'+p,tofile='b/'+p))
 (tests if '.spec.' in p else runtime).append(diff)
(r/'source.patch').write_text(''.join(runtime));(r/'tests.patch').write_text(''.join(tests));(r/'SOURCE-SHA256.json').write_text(json.dumps(m,indent=2)+'\n');(r/'CHANGED-SHA256.json').write_text(json.dumps(changed,indent=2)+'\n')
with tarfile.open(r/'candidate-source.tar.gz','w:gz') as t:
 for p in paths:t.add(c/p,arcname=p,recursive=False)
identity={p:hashlib.sha256((r/p).read_bytes()).hexdigest() for p in ['PREDECESSOR-SNAPSHOT-C0.json','SOURCE-SHA256.json','source.patch','tests.patch','candidate-source.tar.gz']}
for p,h in base.items():assert hashlib.sha256((Path('/private/tmp/st-native-combined-c/candidate')/p).read_bytes()).hexdigest()==h,p
(r/'FREEZE.json').write_text(json.dumps({'status':'frozen for independent implementation review; no integration/activation','artifacts':identity,'files':len(m),'changed':len(changed),'C0VerifiedUnchanged':True},indent=2)+'\n')
print(json.dumps(identity,indent=2));print('\n'.join(changed))
