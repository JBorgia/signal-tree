from pathlib import Path
import json,hashlib,difflib
p=Path('/private/tmp/st-packet-admission-refusal-successor');src=Path('/private/tmp/st-packet-index-admission-r1/candidate');h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();m=json.loads((p/'BASE-SOURCE-SHA256.json').read_text())
assert all(h(src/k)==v for k,v in m.items())
freeze=json.loads((src.parent/'FREEZE.json').read_text());assert all(h(src.parent/k)==v for k,v in freeze['files'].items())
changes={k:h(p/'candidate'/k)for k,v in m.items()if h(p/'candidate'/k)!=v};runtime='packages/kernel/src/lib/internals/entity-publication.ts';assert set(changes)=={runtime}
test='packages/kernel/src/lib/admission-refusal.spec.ts';manifest=dict(m);manifest.update(changes);manifest[test]=h(p/'candidate'/test)
(p/'SOURCE-SHA256.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
(p/'runtime.patch').write_text(''.join(difflib.unified_diff((src/runtime).read_text().splitlines(True),(p/'candidate'/runtime).read_text().splitlines(True),fromfile='a/'+runtime,tofile='b/'+runtime)))
(p/'tests.patch').write_text(''.join(difflib.unified_diff([],(p/'candidate'/test).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+test)))
(p/'VERIFICATION.json').write_text(json.dumps({'r1AllFreezeArtifactsUnchanged':True,'r1SourceFilesVerified':len(m),'allInheritedTestsUnchanged':True,'runtimeChanges':changes,'newSpec':{test:h(p/'candidate'/test)},'artifacts':{k:h(p/k)for k in ['SOURCE-SHA256.json','runtime.patch','tests.patch','focused-first.log','original-precedence-refusal.log','new-controls.log','point.log','source-types.log','spec-types.log']}},indent=2)+'\n')
print('R1 preserved; one runtime branch change; all inherited tests unchanged')
