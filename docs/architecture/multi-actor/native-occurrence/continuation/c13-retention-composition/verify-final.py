from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).parent;c=p/'candidate';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();m=json.loads((p/'BASE-SNAPSHOT.json').read_text());checks={}
for label,root in [('own_copy',c),('frozen_C13',Path('/private/tmp/st-native-combined-c13/candidate'))]:
 bad=[n for n,v in m.items() if not (root/n).is_file() or h(root/n)!=v];checks[label]={'checked':len(m),'mismatches':bad};assert not bad,(label,bad)
(p/'FINAL-SOURCE-VERIFICATION.json').write_text(json.dumps(checks,indent=2)+'\n')
probe='packages/kernel/src/lib/forwarding-retention-probe.spec.ts';link='packages/kernel/src/lib/link-lifetime.spec.ts';summary=[]
for d in sorted((c/'artifacts/forwarding-retention').iterdir()):
 r=json.loads((d/'RESULT.json').read_text());source=json.loads((d/'SOURCE.json').read_text());mutant=r['exit']==1
 expected=hashlib.sha256((c/probe).read_text().replace(' tree.destroy();await flush();',' tree.destroy();Object.assign(box,{__gateRetainedTree:tree});await flush();').encode()).hexdigest() if mutant else m[probe]
 assert source[probe]==expected
 for n,v in source.items():
  if n in m and n!=probe:assert v==m[n],(d,n)
 assert r['executedModes']==9 and len(r['results'])==9
 modes=set()
 for x in r['results']:
  modes.add((x['arm'],x['scenario']));log=Path(x['log']).read_text();artifact=json.loads(Path(x['artifact']).read_text())
  assert artifact['node']=='v24.15.0';assert len(artifact['held'])==12 and len(artifact['released'])==12
  if mutant:assert 'tree: expected true to be false' in log and x['exit']==1
  else:assert x['exit']==0 and '1 passed (1)' in log
 assert len(modes)==9
 summary.append({'directory':str(d),'exit':r['exit'],'modes':9,'node':'v24.15.0','probeSHA256':source[probe],'actualRetainedTreeAssertionFailures':9 if mutant else 0})
(p/'FORWARDING-RAW-VERIFICATION.json').write_text(json.dumps(summary,indent=2)+'\n')
(p/'MUTATION-RESTORATION.json').write_text(json.dumps({n:{'C13':m[n],'afterAllRuns':h(c/n),'restoredExactBytes':h(c/n)==m[n]} for n in [probe,link]},indent=2)+'\n')
for n in ['packages/kernel/src/lib/native-certificate-successor.spec.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts','packages/kernel/src/lib/experimental-publication/private.ts','packages/kernel/src/lib/experimental-publication/entity.ts',probe,link,'tools/verify-gates.mjs','tools/check-forwarding-retention.mjs']:
 dest=p/'reviewed-source'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/n,dest)
(p/'ARTIFACT-INDEX.json').write_text(json.dumps({str(f.relative_to(c)):h(f) for f in sorted((c/'artifacts').rglob('*')) if f.is_file()},indent=2)+'\n')
print(json.dumps(checks));print('verified all nine good and nine intended mutant failures')
