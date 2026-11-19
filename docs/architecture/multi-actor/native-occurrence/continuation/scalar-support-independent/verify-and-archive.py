from pathlib import Path
import hashlib,json,shutil
p=Path(__file__).parent;h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();author=Path('/private/tmp/st-c12-scalar-support-correction');freeze=json.loads((p/'FREEZE.json').read_text());checks={}
assert (p/'FREEZE.json').read_bytes()==(author/'FREEZE.json').read_bytes()
assert h(author/'SNAPSHOT-SCALAR.json')==freeze['manifestSha256']
for side,frozen in [('candidate',author/'candidate'),('oracle',Path('/private/tmp/st-native-combined-c12/candidate'))]:
 m=json.loads((p/(side+'-MANIFEST.json')).read_text())
 for name,root in [('own',p/side),('frozen',frozen)]:
  bad=[n for n,v in m.items() if not (root/n).is_file() or h(root/n)!=v];assert not bad,(side,name,bad)
  checks[side+'-'+name]={'files':len(m),'mismatches':bad}
a=json.loads((p/'oracle-MANIFEST.json').read_text());b=json.loads((p/'candidate-MANIFEST.json').read_text());changed={n:{'base':a.get(n),'candidate':b.get(n)} for n in sorted(a.keys()|b.keys()) if a.get(n)!=b.get(n)}
(p/'EXACT-DELTA.json').write_text(json.dumps(changed,indent=2)+'\n');(p/'FINAL-VERIFICATION.json').write_text(json.dumps(checks,indent=2)+'\n')
for side in ['candidate','oracle']:
 selected=['packages/kernel/src/lib/experimental-publication/private.ts','packages/kernel/src/lib/experimental-publication/lifecycle.ts','packages/kernel/src/lib/experimental-publication/recipient-occurrence.ts','packages/kernel/src/lib/scalar-native-support.spec.ts','packages/kernel/src/lib/parent-proof-safety-falsifier.spec.ts','packages/kernel/src/lib/native-certificate-successor.spec.ts','packages/kernel/src/lib/scalar-frame-publication.spec.ts','packages/kernel/src/lib/publication-evidence-scope-controls.spec.ts','package.json','.nvmrc','tools/spec-type-baseline.json']
 if side=='candidate':selected+=['packages/kernel/src/lib/independent-observation-lifecycle.spec.ts','packages/kernel/src/lib/independent-observation-wrapper-gc.spec.ts']
 for n in selected:
  src=p/side/n;dst=p/'evidence'/side/n;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
for n in ['candidate-source-types-command.json','candidate-source-types-exit.json','candidate-source-types.log','candidate-spec-types-final-command.json','candidate-spec-types-final-exit.json','candidate-spec-types-final.log']:
 dst=p/'author-type-evidence'/n;dst.parent.mkdir(exist_ok=True);shutil.copy2(author/n,dst)
(p/'TOOLCHAIN.json').write_text(json.dumps({'node':'24.15.0','pnpm':'10.17.0','deps':str((p/'candidate/node_modules').resolve()),'lockSha256':h(p/'candidate/pnpm-lock.yaml'),'gcLaunch':{'NODE_OPTIONS':'--expose-gc'}},indent=2)+'\n')
print(json.dumps(checks));print('manifest delta',list(changed))
