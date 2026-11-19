from pathlib import Path
import json,hashlib,difflib
p=Path(__file__).parent
base=json.loads((p/'BASE-C17.json').read_text())
new='packages/kernel/src/lib/value-work-handoff.spec.ts'
comment='packages/kernel/src/lib/recipient-window-independent.spec.ts'
runtime=[];test=[];comments=[];changed=[]
for name in sorted(set(base)|{new}):
 f=p/'candidate'/name
 h=hashlib.sha256(f.read_bytes()).hexdigest()
 if h==base.get(name):continue
 changed.append(name)
 old=(p/'predecessor'/name).read_text() if name!=new else ''
 diff=''.join(difflib.unified_diff(old.splitlines(True),f.read_text().splitlines(True),fromfile='a/'+name if name!=new else '/dev/null',tofile='b/'+name))
 (comments if name==comment else test if name==new else runtime).append(diff)
for name,parts in [('RUNTIME.patch',runtime),('TESTS.patch',test),('TEST-COMMENT.patch',comments)]: (p/name).write_text(''.join(parts))
manifest={name:hashlib.sha256((p/'candidate'/name).read_bytes()).hexdigest() for name in sorted(set(base)|{new})}
(p/'SNAPSHOT-VALUE-WORK.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('changed',changed)
print('manifest',hashlib.sha256((p/'SNAPSHOT-VALUE-WORK.json').read_bytes()).hexdigest())
