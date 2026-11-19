from pathlib import Path
import json,hashlib,shutil
p=Path('/private/tmp/st-c14-finally-successor'); out=Path(__file__).parent
h=lambda b:hashlib.sha256(b).hexdigest()
f=json.loads((p/'FREEZE.json').read_text());assert h((p/'SNAPSHOT.json').read_bytes())==f['manifestSha256'];assert h((p/'RUNTIME.patch').read_bytes())==f['runtimePatchSha256'];assert h((p/'FROM-LINT-PREDECESSOR.patch').read_bytes())==f['patchSha256']
a=json.loads((p/'INPUT-SNAPSHOT.json').read_text());b=json.loads((p/'SNAPSHOT.json').read_text())
changed=[n for n in b if a.get(n)!=b[n]];assert changed==['packages/kernel/src/lib/declaration-finally-precedence.spec.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts'],changed
for name,digest in json.loads((p/'PREWRITE-IDENTITIES.json').read_text()).items():assert h((p/name).read_bytes())==digest
for side,m in [('predecessor',a),('candidate',b)]:
 for name,digest in m.items():
  data=(p/side/name).read_bytes();assert h(data)==digest,(side,name)
  dest=out/side/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 test='packages/kernel/src/lib/declaration-finally-precedence.spec.ts'; data=(p/'precedence.spec.ts').read_bytes(); assert (p/side/test).read_bytes()==data
 (out/side/test).write_bytes(data)
 (out/side/'node_modules').symlink_to('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',target_is_directory=True)
shutil.copyfile(p/'run.py',out/'run.py')
for name in ['FREEZE.json','INPUT-SNAPSHOT.json','SNAPSHOT.json','RUNTIME.patch','FROM-LINT-PREDECESSOR.patch','PREWRITE-IDENTITIES.json','PREWRITTEN-MATRIX.md']:
 shutil.copyfile(p/name,out/name)
(out/'identity.json').write_text(json.dumps({'freeze':f,'baseManifest':h((p/'INPUT-SNAPSHOT.json').read_bytes()),'counts':[len(a),len(b)],'changed':{n:{'base':a.get(n),'candidate':b[n]} for n in changed}},indent=2))
print('verified and copied predecessor 3059 + same prewritten test and candidate 3060')
