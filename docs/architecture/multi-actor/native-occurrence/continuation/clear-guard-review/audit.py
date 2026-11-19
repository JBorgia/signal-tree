from pathlib import Path
import hashlib,json,shutil
p=Path('/private/tmp/st-c19-clear-guard-successor');out=Path(__file__).parent;h=lambda b:hashlib.sha256(b).hexdigest()
raw=(p/'SNAPSHOT-TESTS.json').read_bytes();assert h(raw)=='67be7d9620ff5ce4e426e2b489dd69e1dd6e26f030611d77d3e6036d09275d71';a=json.loads((p/'BASE-C19.json').read_text());b=json.loads(raw);test='packages/kernel/src/lib/entity-large-batches-v16-controls.spec.ts';assert a.keys()==b.keys();assert [n for n in b if a[n]!=b[n]]==[test]
for n,d in b.items():assert h((p/'candidate'/n).read_bytes())==d,n
mutants={}
for side,path in [('current-route-mutant','packages/kernel/src/lib/physical/order-restores-for-placement.ts'),('legacy-mutant','packages/kernel/src/lib/internals/causal-runtime/pending-rollback.ts')]:
 changed={n:h((p/side/n).read_bytes()) for n,d in b.items() if h((p/side/n).read_bytes())!=d};assert list(changed)==[path],(side,changed);mutants[side]=changed
for name in ['BASE-C19.json','SNAPSHOT-TESTS.json','TESTS.patch','CURRENT-ROUTE-MUTANT.patch','LEGACY-MUTANT.patch','ORIGINAL-REPORT.md','make-mutants.py']:
 shutil.copyfile(p/name,out/name)
shutil.copyfile(p/'candidate'/test,out/'candidate.spec.ts');shutil.copyfile(Path('/private/tmp/st-native-combined-c19/candidate')/test,out/'original.spec.ts')
(out/'IDENTITY.json').write_text(json.dumps({'manifest':h(raw),'baseline':h((p/'BASE-C19.json').read_bytes()),'entries':len(b),'onlyChangedTest':{test:{'base':a[test],'candidate':b[test]}},'mutantOnlyChanges':mutants},indent=2)+'\n');print('Verified frozen candidate only test change; both mutation copies differ by exactly their designated runtime file; same exact test bytes.')
