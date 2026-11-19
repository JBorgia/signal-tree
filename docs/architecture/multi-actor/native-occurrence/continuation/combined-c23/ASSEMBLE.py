from pathlib import Path
import json,hashlib,shutil
base=Path('/private/tmp/st-native-combined-c21');left=Path('/private/tmp/st-native-combined-c22');out=Path('/private/tmp/st-native-combined-c23');out.mkdir(exist_ok=False);dst=out/'candidate';dst.mkdir()
b=json.loads((base/'SNAPSHOT-C21.json').read_text());m=json.loads((left/'SNAPSHOT-C22.json').read_text());sources={p:left/'candidate'/p for p in m};changes=[];touched=set()
inputs=[('/private/tmp/st-c21-gc-routing-successor','SNAPSHOT-CANDIDATE.json'),('/private/tmp/st-c21-fixture-corrections','SNAPSHOT-CANDIDATE.json'),('/private/tmp/st-c21-recipient-positive-counterparts','SNAPSHOT-COUNTERPARTS.json'),('/private/tmp/st-restoration-ordinary-calibration','SNAPSHOT-CANDIDATE.json')]
for directory,filename in inputs:
 root=Path(directory);incoming=json.loads((root/filename).read_text())
 for p,h in incoming.items():assert hashlib.sha256((root/'candidate'/p).read_bytes()).hexdigest()==h,(directory,p)
 delta=[p for p in set(b)|set(incoming) if b.get(p)!=incoming.get(p)]
 for p in sorted(delta):
  assert p not in touched,(directory,p);touched.add(p);assert m.get(p)==b.get(p),(directory,p)
  assert p.endswith('.spec.ts') or p in ['packages/kernel/vitest.config.ts','packages/kernel/vitest.retention.config.ts','tools/check-forwarding-retention.mjs','tools/lib/forwarding-retention-matrix.mjs','tools/verify-gates.mjs'],p
  changes.append({'path':p,'source':str(root/filename),'before':b.get(p),'after':incoming.get(p)})
  if p in incoming:m[p]=incoming[p];sources[p]=root/'candidate'/p
  else:del m[p];del sources[p]
for p,h in m.items():
 data=sources[p].read_bytes();assert hashlib.sha256(data).hexdigest()==h,p
 target=dst/p;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(sources[p],target)
(dst/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(out/'SNAPSHOT-C23.json').write_text(json.dumps(dict(sorted(m.items())),indent=2)+'\n');(out/'COMPOSITION.json').write_text(json.dumps({'base':str(base),'left':str(left),'changes':changes,'runtimeUnchangedFromC22':True},indent=2)+'\n')
s=(left/'run.py').read_text().replace('SNAPSHOT-C22.json','SNAPSHOT-C23.json').replace("ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations')", "ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(dest/'public-observations')").replace("(dest/'observations').mkdir()", "(dest/'observations').mkdir();(dest/'public-observations').mkdir();(dest/'diagnostics').mkdir();env['ST_C21_DIAGNOSTIC_OUTPUT']=str(dest/'diagnostics')")
(out/'run.py').write_text(s)
preload=Path('/Users/jonathanborgia/code/signaltree/docs/architecture/multi-actor/native-occurrence/continuation/c21-portable-source/diagnostic-redirect.cjs');shutil.copyfile(preload,out/'diagnostic-redirect.cjs')
print(json.dumps({'count':len(m),'changes':len(changes),'manifestSha256':hashlib.sha256((out/'SNAPSHOT-C23.json').read_bytes()).hexdigest()}))
