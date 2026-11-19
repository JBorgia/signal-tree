from pathlib import Path
import json,hashlib,shutil
p=Path('/private/tmp/st-c19-recipient-positive-counterparts');base=Path('/private/tmp/st-native-combined-c19');out=Path(__file__).parent;h=lambda b:hashlib.sha256(b).hexdigest()
f=json.loads((p/'FREEZE.json').read_text());raw=(p/'SNAPSHOT.json').read_bytes();assert h(raw)==f['manifestSHA256'];assert h((p/'tests.patch').read_bytes())==f['patchSHA256'];a=json.loads((base/'SNAPSHOT-C19.json').read_text());b=json.loads(raw);n='packages/kernel/src/lib/recipient-positive-counterparts.spec.ts';assert set(b)-set(a)=={n};assert all(b[k]==d for k,d in a.items())
for k,d in b.items():assert h((p/'candidate'/k).read_bytes())==d,k
for name in ['occurrence-successor.spec.ts','recipient-window-review.spec.ts']:
 k='packages/kernel/src/lib/'+name;assert (base/'candidate'/k).read_bytes()==(p/'candidate'/k).read_bytes();shutil.copyfile(base/'candidate'/k,out/('ORIGINAL-'+name))
patch=(p/'tests.patch').read_text().splitlines(keepends=True);reconstructed=''.join(line[1:] for line in patch if line.startswith('+') and not line.startswith('+++'));assert reconstructed==(p/'candidate'/n).read_text();assert h((p/'candidate'/n).read_bytes())==f['addedSpecSHA256']
for name in ['REPORT.md','MAPPING.md','FREEZE.json','tests.patch','SNAPSHOT.json','diagnostic-redirect.cjs','ORIGINAL-25-FIRST-FAILURES.log']:shutil.copyfile(p/name,out/name)
shutil.copyfile(p/'candidate'/n,out/'recipient-positive-counterparts.spec.ts')
for group in ['positive-first','original-counterweights','spec-types']:
 dest=out/'author-evidence'/group;dest.mkdir(parents=True,exist_ok=True)
 for name in ['COMMAND.json','RESULT.json','first.log']:shutil.copyfile(p/'runs'/group/name,dest/name)
(out/'IDENTITY.json').write_text(json.dumps({'freeze':f,'verifiedCandidateEntries':len(b),'unchangedC19Entries':len(a),'changed':[n]},indent=2)+'\n');print('Verified frozen candidate, patch reconstruction, only additive spec, unchanged original bodies and archived raw results.')
