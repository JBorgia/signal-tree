from pathlib import Path
import json,hashlib,shutil
out=Path(__file__).parent
roots={'c18':Path('/private/tmp/st-native-combined-c18'),'maintenance':Path('/private/tmp/st-c18-lint-maintenance'),'c19':Path('/private/tmp/st-native-combined-c19')};names={'c18':'SNAPSHOT-C18.json','maintenance':'SNAPSHOT.json','c19':'SNAPSHOT-C19.json'}
h=lambda b:hashlib.sha256(b).hexdigest();ms={};report={'identities':{}}
for key,root in roots.items():
 raw=(root/names[key]).read_bytes();m=json.loads(raw);ms[key]=m
 for n,d in m.items():assert h((root/'candidate'/n).read_bytes())==d,(key,n)
 report['identities'][key]={'sha256':h(raw),'entries':len(m)}
a,b,c=[ms[k] for k in ['c18','maintenance','c19']];w='packages/kernel/src/lib/'
changes={n:{'maintenance':b.get(n),'c19':c.get(n)} for n in set(b)|set(c) if b.get(n)!=c.get(n)}
assert set(changes)=={w+'publication-enrollment-invariance.spec.ts',w+'publication-enrollment-adjudicated.spec.ts',w+'whole-bounded-qualification.spec.ts',w+'whole-mixed-promises.spec.ts'},changes
runtime=[n for n in set(a)|set(c) if a.get(n)!=c.get(n) and n.startswith('packages/') and n.endswith('.ts') and '.spec.' not in n];assert runtime==[w+'entity-signal.ts'],runtime
assert c[w+'entity-signal.ts']==b[w+'entity-signal.ts']
arc=roots['c19']/'research-only'
assert (arc/'publication-enrollment-invariance.spec.ts').read_bytes()==(roots['c18']/'candidate'/w/'publication-enrollment-invariance.spec.ts').read_bytes()
assert (arc/'ORIGINAL-adjudicated-before-disposal-cutoff.spec.ts').read_bytes()==(roots['c18']/'candidate'/w/'publication-enrollment-adjudicated.spec.ts').read_bytes()
original=(arc/'ORIGINAL-whole-bounded-qualification.spec.ts').read_bytes();case=(arc/'original-mixed-immediate-progress.case.txt').read_bytes();live=(roots['c19']/'candidate'/w/'whole-bounded-qualification.spec.ts').read_bytes()
assert original==(roots['maintenance']/'candidate'/w/'whole-bounded-qualification.spec.ts').read_bytes()
assert original.count(case)==1;assert original.replace(case,b'',1)==live
counterpart=Path('/private/tmp/st-mixed-rollback-composition-counterpart/candidate')/w/'whole-mixed-promises.spec.ts';assert counterpart.read_bytes()==(roots['c19']/'candidate'/w/'whole-mixed-promises.spec.ts').read_bytes();assert h(counterpart.read_bytes())=='bbbc1db97df42d362bbef97a15afcc3562e4a19fe4fb3a4a0d83004cf1613bec'
report.update(changesFromMaintenance=changes,runtimeChangesFromC18=runtime,archiveHashes={f.name:h(f.read_bytes()) for f in arc.iterdir() if f.is_file()},mixedCounterpartSHA256=h(counterpart.read_bytes()))
for key,root in roots.items():
 dest=out/key;dest.mkdir(exist_ok=True);shutil.copyfile(root/names[key],dest/names[key])
 for n in ['MAIN-REVIEW.md','FREEZE.json','ENROLLMENT-DISPOSITION.md','MIXED-DISPOSITION.md','COMPOSITION.json']:
  if (root/n).exists():shutil.copyfile(root/n,dest/n)
 if (root/'research-only').exists():shutil.copytree(root/'research-only',dest/'research-only',dirs_exist_ok=True)
(out/'AUDIT.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
