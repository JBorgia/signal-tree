from pathlib import Path
import json,hashlib,difflib,subprocess
out=Path(__file__).resolve().parent;c=out/'candidate';m=json.loads((out/'BASE-MANIFEST.json').read_text());base=Path('/private/tmp/st-native-combined-c8a/candidate')
extra=['packages/kernel/src/lib/point-result-demand.spec.ts','packages/kernel/src/lib/point-result-allocation.spec.ts'];runtime='packages/kernel/src/lib/entity-signal.ts'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changed=[p for p,h in m.items() if sha(c/p)!=h];assert changed==[runtime],changed
assert all(sha(base/p)==h for p,h in m.items())
tests=''.join(''.join(difflib.unified_diff([], (c/p).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+p)) for p in extra)
(out/'tests.patch').write_text(tests);(out/'FROM-C8a.patch').write_text((out/'runtime.patch').read_text()+tests)
# Only line positions may differ from the reviewed runtime patch.
def edits(s):return [l for l in s.splitlines() if l.startswith(('+','-')) and not l.startswith(('+++','---'))]
assert edits((out/'runtime.patch').read_text())==edits((out/'research/runtime.patch').read_text())
v=out/'patch-replay';v.mkdir(exist_ok=True);target=v/runtime;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((base/runtime).read_bytes())
r=subprocess.run(['patch','--fuzz=0','-p1','-i',str(out/'FROM-C8a.patch')],cwd=v,capture_output=True,text=True);(out/'patch-replay.log').write_text(r.stdout+r.stderr);assert r.returncode==0
for p in [runtime]+extra:assert sha(v/p)==sha(c/p)
source={p:sha(c/p) for p in sorted(set(m)|set(extra))};(out/'SNAPSHOT-POINT-DEMAND-C8a.json').write_text(json.dumps(source,indent=2)+'\n')
a=[json.loads(x) for x in (out/'runs/baseline-controls/allocation.jsonl').read_text().splitlines()];b=[json.loads(x) for x in (out/'runs/successor-controls/allocation.jsonl').read_text().splitlines()];assert len(a)==len(b)==4
comparison=[]
for x,y in zip(a,b):
 for k in ['width','size','writes']:assert x[k]==y[k]
 delta={k:y[k]-x[k] for k in ['containers','entries','mapArrays','mapEntries']};assert delta=={'containers':-200,'entries':0,'mapArrays':-600,'mapEntries':-600}
 comparison.append({'baseline':x,'successor':y,'delta':delta})
(out/'ALLOCATION-COMPARISON.json').write_text(json.dumps(comparison,indent=2)+'\n')
runs={p.parent.name:json.loads(p.read_text()) for p in (out/'runs').glob('*/RESULT.json')};assert all(x['source_unchanged'] for x in runs.values());assert len(runs)==7
assert all(runs[n]['exit']==0 for n in ['baseline-controls','successor-controls','source-types','spec-types','optional-diagnostic-no-output'])
assert all(runs[n]['exit']==1 for n in ['baseline-point-gate','successor-point-gate'])
assert not (out/'runs/optional-diagnostic-no-output/allocation.jsonl').exists()
(out/'FREEZE.json').write_text(json.dumps({'baseline':'/private/tmp/st-native-combined-c8a/candidate','baseline_manifest_sha256':sha(out/'BASE-MANIFEST.json'),'source_manifest_sha256':sha(out/'SNAPSHOT-POINT-DEMAND-C8a.json'),'runtime_patch_sha256':sha(out/'runtime.patch'),'tests_patch_sha256':sha(out/'tests.patch'),'combined_patch_sha256':sha(out/'FROM-C8a.patch'),'manifest_file_count':len(source),'changed_baseline_files':changed,'added_files':extra,'runtime_edit_payload_matches_reviewed_patch':True,'combined_patch_replay_exact':True,'baseline_unchanged':True,'runs':runs,'limits':'No CPU/heap/release claim; original point gate red; no budget changes; original unsupported monkeypatch research retained, not promoted or re-executed.'},indent=2)+'\n')
print(json.dumps({'manifest':sha(out/'SNAPSHOT-POINT-DEMAND-C8a.json'),'changed':changed,'added':extra,'runs':runs},indent=2))
