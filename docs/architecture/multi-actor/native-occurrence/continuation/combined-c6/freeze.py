from pathlib import Path
import json,hashlib,difflib
r=Path(__file__).resolve().parent;c=r/'candidate';h=lambda b:hashlib.sha256(b).hexdigest()
o=json.loads((r/'ours-manifest.json').read_text());t=json.loads((r/'theirs-manifest.json').read_text());b=json.loads((r/'base-manifest.json').read_text())
paths=sorted(set(o)|{p for p in t if t.get(p)!=b.get(p)})
m={p:h((c/p).read_bytes()) for p in paths}
(r/'SNAPSHOT-C6.json').write_text(json.dumps(m,indent=2)+'\n')
changed=[p for p in paths if m[p]!=o.get(p)]
patch=''
for p in changed:
 old=(Path('/private/tmp/st-native-combined-c5/candidate')/p).read_text().splitlines(True) if p in o else []
 patch+=''.join(difflib.unified_diff(old,(c/p).read_text().splitlines(True),fromfile='a/'+p if p in o else '/dev/null',tofile='b/'+p))
(r/'FROM-C5.patch').write_text(patch)
prior_changed=[p for p in o if o.get(p)!=b.get(p)]
assert all(m[p]==o[p] for p in prior_changed)
enrollment=json.loads(Path('/private/tmp/st-dynamic-member-enrollment-successor/CHANGED-SHA256.json').read_text())
check={p:{'c6':m[p],'shared':t[p],'equal':m[p]==t[p]} for p in enrollment if not p.endswith('.spec.ts')}
assert len(check)==6 and all(v['equal'] for v in check.values())
(r/'PRESERVATION.json').write_text(json.dumps({'allC5ChangesFromC0Unchanged':prior_changed,'sixEnrollmentRuntimeFiles':check},indent=2)+'\n')
review=Path('/private/tmp/st-shared-construction-independent/REVIEW.md')
(r/'REVIEW.md').write_bytes(review.read_bytes())
(r/'FREEZE.json').write_text(json.dumps({'manifestSha256':h((r/'SNAPSHOT-C6.json').read_bytes()),'patchSha256':h((r/'FROM-C5.patch').read_bytes()),'reviewSha256':h(review.read_bytes()),'files':len(m),'changedFiles':changed,'unmodifiedC5ChangeCount':len(prior_changed)},indent=2)+'\n')
print((r/'FREEZE.json').read_text())
