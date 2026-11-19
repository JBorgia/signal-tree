from pathlib import Path
import os,json,hashlib
p=Path(__file__).parent;c=p/'candidate';nm=c/'node_modules';old=b'/private/tmp/st-parent-freshness-resumed/baseline-reentry/candidate/node_modules';new=str(nm).encode();changed=[]
for root,dirs,files in os.walk(nm,followlinks=False):
 if Path(root).name=='.bin':
  for name in files:
   f=Path(root)/name
   if f.is_symlink():continue
   b=f.read_bytes()
   if old in b: f.write_bytes(b.replace(old,new));changed.append(str(f.relative_to(nm)))
(p/'DEPENDENCY-REPAIR.json').write_text(json.dumps({'changedOwnCopiedShims':changed,'replacement':str(nm),'noInstall':True},indent=2)+'\n')
m=json.loads((p/'BASE-SOURCE.json').read_text());assert all(hashlib.sha256((c/n).read_bytes()).hexdigest()==h for n,h in m.items())
(p/'PRE-IMPLEMENTATION.json').write_text(json.dumps({'baselineFiles':len(m),'allUnchanged':True,'testPatchUnchanged':(p/'tests.patch').read_bytes()==Path('/private/tmp/st-parent-snapshot-c8-controls/tests.patch').read_bytes(),'testsRun':False,'runtimeEdits':False},indent=2)+'\n')
