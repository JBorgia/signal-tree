from pathlib import Path
import json,hashlib,shutil
p=Path('/private/tmp/st-c17-value-work-correction');out=Path(__file__).parent
h=lambda b:hashlib.sha256(b).hexdigest()
a=json.loads((p/'BASE-C17.json').read_text());b=json.loads((p/'SNAPSHOT-VALUE-WORK.json').read_text());assert h((p/'SNAPSHOT-VALUE-WORK.json').read_bytes())=='e87715deeebe1392fb4d8996376b6cb2e2a9e9678d47e8dbcf864857560d8382'
for side,m in [('predecessor',a),('candidate',b)]:
 for n,digest in m.items():
  data=(p/side/n).read_bytes();assert h(data)==digest,(side,n)
  target=out/side/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
 (out/side/'node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
 test='packages/kernel/src/lib/value-work-handoff.spec.ts';(out/side/test).write_bytes((p/'candidate'/test).read_bytes())
for name in ['BASE-C17.json','SNAPSHOT-VALUE-WORK.json','RUNTIME.patch','TESTS.patch','TEST-COMMENT.patch','ORIGINAL-C15-FAILURE.log']:
 shutil.copyfile(p/name,out/name)
shutil.copyfile('/private/tmp/st-parent-freshness-implementation-independent/finally-successor-review/run.py',out/'run.py')
changed={n:{'base':a.get(n),'candidate':b.get(n)} for n in set(a)|set(b) if a.get(n)!=b.get(n)}
(out/'IDENTITY.json').write_text(json.dumps({'base':h((p/'BASE-C17.json').read_bytes()),'candidate':h((p/'SNAPSHOT-VALUE-WORK.json').read_bytes()),'counts':[len(a),len(b)],'changed':changed},indent=2)+'\n')
print('Verified and copied exact manifests, plus identical new test on predecessor')
