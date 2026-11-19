from pathlib import Path
import json,hashlib,shutil
out=Path(__file__).parent;p=Path('/private/tmp/st-c12-enrollment-independent-review');c=Path('/private/tmp/st-native-combined-c15')
h=lambda b:hashlib.sha256(b).hexdigest(); raw=(c/'SNAPSHOT-C15.json').read_bytes();assert h(raw)=='02aba88c81c413700ef4af2f9bf8facc422cabf01fddf6a31b4ec2d777b16568';m=json.loads(raw)
for n,d in m.items():assert h((c/'candidate'/n).read_bytes())==d,n
files=['VALUE-WORK-DESIGN.md','REVIEW.md','c15-equal-sibling-command.json','c15-equal-sibling-exit.json','c15-equal-sibling.log','baseline-equal-sibling-command.json','baseline-equal-sibling-exit.json','baseline-equal-sibling.log','c15-equal-proof-trace-observations']
e={}
for n in files:
 data=(p/n).read_bytes();(out/n).write_bytes(data);e[str(p/n)]=h(data)
for n in ['link.ts','experimental-publication/private.ts','experimental-publication/lifecycle.ts','experimental-publication/recipient-occurrence.ts','scalar-frame-publication.spec.ts']:
 file=c/'candidate/packages/kernel/src/lib'/n;e[str(file)]=h(file.read_bytes())
(out/'IDENTITY.json').write_text(json.dumps({'manifest':h(raw),'verifiedEntries':len(m),'inputs':e},indent=2)+'\n')
print('Verified C15 manifest and all source entries; archived exact design and raw counterexample evidence.')
