from pathlib import Path
import json,hashlib
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
a=Path('/private/tmp/st-native-combined-c20');b=Path('/private/tmp/st-native-combined-c21')
m=json.loads((a/'SNAPSHOT-C20.json').read_text());n=json.loads((b/'SNAPSHOT-C21.json').read_text())
result={'C20':h(a/'SNAPSHOT-C20.json'),'C21':h(b/'SNAPSHOT-C21.json'),'count':len(n),'added':sorted(n.keys()-m.keys()),'removed':sorted(m.keys()-n.keys()),'changed':{p:{'C20':m[p],'C21':n[p]} for p in n.keys()&m.keys() if n[p]!=m[p]},'C21_mismatches':[p for p,v in n.items() if h(b/'candidate'/p)!=v],'C20_mismatches':[p for p,v in m.items() if h(a/'candidate'/p)!=v]}
for f in ['run-full-watchdog.py','progress-reporter.mjs','diagnostic-redirect.cjs','COMPOSITION.json','tests.patch']:
 result[f]=h(b/f)
p='packages/kernel/src/lib/entity-large-batches-v16-controls.spec.ts'
result['reviewed_clear_spec']=h(Path('/private/tmp/st-c19-clear-guard-successor/candidate')/p)
print(json.dumps(result,indent=2))
