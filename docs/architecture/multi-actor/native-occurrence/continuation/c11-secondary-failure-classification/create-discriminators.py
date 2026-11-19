from pathlib import Path
import re,difflib
p=Path(__file__).parent
for side in ['candidate','oracle']:
 root=p/side/'packages/kernel/src/lib/internals'
 for name in ['intercept-leaf-signals','causal-runtime/heterogeneous-live-subject']:
  f=root/(name+'.spec.ts'); old=f.read_text(); new=old
  if name=='intercept-leaf-signals':
   new="import { withScalarPublicationCoverage } from './scalar-publication-coverage';\n"+new
   new,n=re.subn(r'(expect\(list\[\d\]\.meta\)\.toEqual\()({[^}]*})(\);)',r'\1withScalarPublicationCoverage(\2, undefined)\3',new)
   assert n==7,n
  else:
   assert new.count("mode === 'throw' ? sentinel : /stale/")==1
   new=new.replace("mode === 'throw' ? sentinel : /stale/", "mode === 'throw' ? sentinel : 'Joint preparation reentered installation'")
  target=f.with_name('independent-'+f.name);target.write_text(new)
  (p/(side+'-'+f.stem+'.patch')).write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile=str(f),tofile=str(target))))
