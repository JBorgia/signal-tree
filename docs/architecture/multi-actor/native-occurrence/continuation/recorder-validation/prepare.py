from pathlib import Path
import hashlib,json,shutil,os
r=Path(__file__).resolve().parent;s=Path('/private/tmp/st-native-combined-c21');m=json.loads((s/'SNAPSHOT-C21.json').read_text());d=r/'candidate';d.mkdir(exist_ok=False)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p,v in m.items():
 assert h(s/'candidate'/p)==v,p
 t=d/p;t.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(s/'candidate'/p,t);assert h(t)==v,p
os.symlink('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',d/'node_modules')
for f in ['SNAPSHOT-C21.json','progress-reporter.mjs']:shutil.copyfile(s/f,r/f)
(r/'diagnostic-redirect.cjs').write_text((s/'diagnostic-redirect.cjs').read_text().replace(str(s/'recipient-traces.jsonl'),str(r/'recipient-traces.jsonl')))
shutil.copyfile(s/'runs/full-kernel-watchdog/COMMAND.json',r/'FULL-COMMAND.json')
(r/'PREPARED.json').write_text(json.dumps({'manifest':h(r/'SNAPSHOT-C21.json'),'verifiedFiles':len(m),'rootEdits':False},indent=2)+'\n');print('prepared3066',flush=True)
