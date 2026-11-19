from pathlib import Path
import json,hashlib,shutil,difflib
p=Path(__file__).resolve().parent;c=Path('/private/tmp/st-v16-integration-candidate');d=p/'dispatch-mutant';m=json.loads((p/'MANIFEST.json').read_text());d.mkdir()
for n,h in m.items():
 f=c/n;assert hashlib.sha256(f.read_bytes()).hexdigest()==h,n
 t=d/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,t)
(d/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
n='packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts';f=d/n;s=f.read_text();v=s.replace("import { getEntityPreparationReader } from '../entity-preparation-reader';\n",'').replace('  const reader = getEntityPreparationReader(collectionNode);\n  if (reader !== undefined) return reader(key);\n','');assert v!=s and 'getEntityPreparationReader' not in v;f.write_text(v)
new={n:hashlib.sha256((d/n).read_bytes()).hexdigest() for n in m};delta=[n for n in m if new[n]!=m[n]];assert len(delta)==1
(p/'MUTANT-MANIFEST.json').write_text(json.dumps(new,indent=2)+'\n');(p/'MUTANT-IDENTITY.json').write_text(json.dumps({'candidate':str(d),'manifest':hashlib.sha256(json.dumps(new,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'delta':delta,'expectedFailure':'cold file alone: new nodeFacadeMaterialized or fieldFacadesMaterialized assertion, not comparison sentinel'},indent=2)+'\n');(p/'mutation.patch').write_text(''.join(difflib.unified_diff(s.splitlines(True),v.splitlines(True),fromfile='a/'+n,tofile='b/'+n)))
print((p/'MUTANT-IDENTITY.json').read_text())
