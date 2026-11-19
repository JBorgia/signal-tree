from pathlib import Path
import json,hashlib,difflib
p=Path('/private/tmp/st-c21-point-work-attribution'); c=p/'candidate'
h=lambda b:hashlib.sha256(b).hexdigest()
base=json.loads((p/'BASE-C21.json').read_text()); bad=[k for k,v in base.items() if h((c/k).read_bytes())!=v]
assert not bad,bad
original=(c/'packages/kernel/src/lib/entity-granular-reactivity.spec.ts').read_text()
probe=(p/'PROBE.spec.ts').read_text(); counter=(p/'COUNTER-EXACT.txt').read_text()
assert counter in original and counter in probe
name='packages/kernel/src/lib/point-work-attribution.spec.ts'
assert (c/name).read_text()==probe
(p/'DIAGNOSTIC.patch').write_text(''.join(difflib.unified_diff([],probe.splitlines(True),fromfile='/dev/null',tofile='b/'+name)))
snapshot={**base,name:h(probe.encode())};(p/'SNAPSHOT-DIAGNOSTIC.json').write_text(json.dumps(snapshot,indent=2)+'\n')
a=json.loads((p/'rows-2000.json').read_text());b=json.loads((p/'rows-20000.json').read_text())
assert a['events']==b['events'] and a['perWrite']==b['perWrite']==[69]*200
(p/'AUDIT.json').write_text(json.dumps({'baseManifestSha256':h((p/'BASE-C21.json').read_bytes()),'verifiedUnchangedBaselineFiles':len(base),'counterByteExactSha256':h(counter.encode()),'eventsIncludingStacksCallsVisitsIdenticalAcrossSizes':True,'diagnosticManifestSha256':h((p/'SNAPSHOT-DIAGNOSTIC.json').read_bytes())},indent=2)+'\n')
