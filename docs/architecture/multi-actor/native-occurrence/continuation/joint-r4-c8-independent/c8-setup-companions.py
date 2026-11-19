from pathlib import Path
import shutil,difflib,json
b=Path('/private/tmp/st-r4-review-resumed');root=b/'c8-candidate/packages/kernel/src/lib';patch=''
for name in ['singleton-row-reuse','packet-index-review','publication-retirement-boundaries']:
 p=root/(name+'.spec.ts');s=p.read_text();assert s.count('changed during finalization')==1
 new=s.replace('changed during finalization','changed before installation');q=root/('c8-review-'+name+'.spec.ts');q.write_text(new)
 patch+=''.join(difflib.unified_diff(s.splitlines(True),new.splitlines(True),fromfile=p.name,tofile=q.name))
(b/'c8-companions.patch').write_text(patch)
for group in ['c7a-controls','retirement-composition']:
 for f in ['first.log','COMMAND.json','RESULT.json']:
  p=Path('/private/tmp/st-native-combined-c8/runs')/group/f
  if p.exists():shutil.copy2(p,b/('c8-main-'+group+'-'+f))
