from pathlib import Path
import hashlib,json,difflib
b=Path(__file__).parent;c=b/'candidate';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();baseline=json.loads((b/'BASELINE.json').read_text());pre=json.loads((b/'PREREGISTERED.json').read_text())
assert all(sha(c/f)==h for f,h in pre.items()),'preregistered fixtures not restored'
changed=[f for f,h in baseline.items() if sha(c/f)!=h]
expected=['packages/kernel/src/lib/'+n+'.spec.ts' for n in ['entity-egress-footprint','branch-omission-correctness','link-commit-ordering','link-commit-boundary-carrier']]
assert sorted(changed)==sorted(expected),changed
patch=[]
for f in expected:
 before=(b/'original-fixtures'/Path(f).name).read_text();after=(c/f).read_text();patch.extend(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+f,tofile='b/'+f))
f='packages/kernel/src/lib/oracle-alignment-independent.spec.ts';patch.extend(difflib.unified_diff([], (c/f).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+f))
(b/'oracle-only.patch').write_text(''.join(patch))
# Ensure the adjacent age42 test body is unchanged, independently of whole-file diff.
f='packages/kernel/src/lib/branch-omission-correctness.spec.ts';a=(b/'original-fixtures'/Path(f).name).read_text();z=(c/f).read_text();label="  it('inspection-only omission does not hitchhike";stop="  it('a transaction holds omission"
assert a[a.index(label):a.index(stop)]==z[z.index(label):z.index(stop)]
identities={'baseSource':'/private/tmp/st-row-source-successor/candidate','unchangedBaselinePackageFiles':len(baseline)-len(changed),'modifiedExistingFiles':changed,'preexecutionTests':pre,'patchSha256':sha(b/'oracle-only.patch'),'runtimeEntitySignalSha256':sha(c/'packages/kernel/src/lib/entity-signal.ts'),'logs':{p.name:sha(p) for p in b.glob('*.log')}}
(b/'FINAL-IDENTITY.json').write_text(json.dumps(identities,indent=2)+'\n')
print(json.dumps(identities,indent=2))
