from pathlib import Path
import hashlib,json,difflib
r=Path('/private/tmp/st-c25-equal-owner');c=r/'candidate';b=Path('/private/tmp/st-c24-equal-owner/candidate');base=json.loads((r/'BASE-MANIFEST.json').read_text());paths=set(base)
for p in (c/'packages').rglob('*'):
 if p.is_file() and p.suffix in ['.ts','.tsx'] and 'node_modules' not in p.parts:paths.add(str(p.relative_to(c)))
manifest={k:hashlib.sha256((c/k).read_bytes()).hexdigest() for k in sorted(paths)};(r/'SNAPSHOT-C25.json').write_text(json.dumps(manifest,indent=2)+'\n')
patches={'runtime':[],'controls':[]};changed=[]
for k,h in manifest.items():
 if base.get(k)==h:continue
 changed.append(k);old=(b/k).read_text() if (b/k).is_file() else '';new=(c/k).read_text();kind='controls' if '.spec.' in k else 'runtime';patches[kind].append(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='a/'+k,tofile='b/'+k)))
for kind,parts in patches.items():(r/(kind+'.patch')).write_text(''.join(parts))
freeze={'status':'FROZEN C25 NON-INTEGRATABLE: derived same-input history remains unbounded; literal-only bound','baseC24':'cb54add521dafd9ec875b87d6c19f85de38e4b56d0c79c147a7c3c3e41306bcd','files':{n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in ['SNAPSHOT-C25.json','runtime.patch','controls.patch','research/instrumentation-final.patch','research/RESTORED-SOURCE.json','research/SECOND-RESTORE.json','research/ROOTS-LARGE.jsonl','research/ROOTS-DERIVED.jsonl']},'changedFiles':changed,'Main13Unchanged':(c/'packages/kernel/src/lib/equal-owner-admission.spec.ts').read_bytes()==(b/'packages/kernel/src/lib/equal-owner-admission.spec.ts').read_bytes(),'originalReact6Unchanged':(c/'packages/react/src/branch-declaration-qualification.spec.tsx').read_bytes()==(b/'packages/react/src/branch-declaration-qualification.spec.tsx').read_bytes(),'noResearchExports':not any('__c25' in (c/k).read_text() for k in manifest if k.endswith('.ts') and '.spec.' not in k)};(r/'FREEZE.json').write_text(json.dumps(freeze,indent=2)+'\n');print(json.dumps(freeze,indent=2))
