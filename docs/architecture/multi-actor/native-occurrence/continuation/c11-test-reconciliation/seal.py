from pathlib import Path
import json,hashlib,subprocess,shutil
p=Path(__file__).parent;m=json.loads((p/'SNAPSHOT-C11-INPUT.json').read_text());changed=json.loads((p/'CHANGED.json').read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();verification={};out={}
for name,root in [('frozen',Path('/private/tmp/st-native-combined-c11/candidate')),('original',p/'original'),('candidate',p/'candidate')]:
 actual={n:h(root/n) for n in m};diff=[n for n,v in m.items() if actual[n]!=v]
 assert set(diff)==(set(changed) if name=='candidate' else set()),(name,diff)
 verification[name]={'checked':len(m),'differences':diff}
 if name=='candidate':(p/'SNAPSHOT-RECONCILED.json').write_text(json.dumps(actual,indent=2)+'\n')
for n in changed+['packages/kernel/src/lib/occupancy-successor-realization.spec.ts','tools/spec-types-baseline.json']:
 if not (p/'original'/n).exists():continue
 out[n]={'before':h(p/'original'/n),'after':h(p/'candidate'/n)}
(p/'SOURCE-HASHES.json').write_text(json.dumps(out,indent=2)+'\n');(p/'FINAL-VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n')
d=p/'runs/patch-apply-check';d.mkdir();args=['git','apply','--check',str(p/'TESTS.patch')]
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(p/'original'),'argv':args},indent=2))
with (d/'first.log').open('w') as f:r=subprocess.run(args,cwd=p/'original',stdout=f,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));assert r.returncode==0
for n in changed:
 dest=p/'overlay'/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/'candidate'/n,dest)
(p/'SPEC-RATCHET-COMPARISON.json').write_text(json.dumps({'original':h(p/'runs/original-spec-ratchet/first.log'),'updated':h(p/'runs/updated-spec-ratchet/first.log'),'identical':(p/'runs/original-spec-ratchet/first.log').read_bytes()==(p/'runs/updated-spec-ratchet/first.log').read_bytes()},indent=2))
print(json.dumps(verification));print('patch applies cleanly')
