from pathlib import Path
import json,hashlib,shutil,subprocess
root=Path(__file__).parent
sources={'c8a':('/private/tmp/st-native-combined-c8a','SNAPSHOT-C8a.json'),'parent':('/private/tmp/st-parent-freshness-resumed/c8-proof','SNAPSHOT-PROOF.json'),'c10':('/private/tmp/st-native-combined-c10-promoted','SNAPSHOT.json')}
for label,(folder,manifest) in sources.items():
 src=Path(folder);dest=root/label;dest.mkdir();m=json.loads((src/manifest).read_text());(dest/'BASE-MANIFEST.json').write_text(json.dumps(m,indent=2))
 for name,digest in m.items():
  f=src/'candidate'/name
  assert hashlib.sha256(f.read_bytes()).hexdigest()==digest,name
  target=dest/'candidate'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
 deps=dest/'candidate/node_modules';old='/private/tmp/st-dormant-publication-feasibility/candidate/node_modules'
 subprocess.run(['cp','-cR',old,str(deps)],check=True)
 for f in deps.rglob('*'):
  if f.is_file() and not f.is_symlink() and f.parent.name=='.bin':
   try:t=f.read_text()
   except UnicodeError:continue
   if old in t:f.write_text(t.replace(old,str(deps)))
 runner=Path('/private/tmp/st-dormant-publication-feasibility/run-gate.py').read_text();runner=runner.replace(";paths.update(['packages/kernel/src/lib/dormant-feasibility-discriminator.spec.ts','packages/kernel/src/lib/dormant-input-discriminator.spec.ts'])",'')
 (dest/'run-gate.py').write_text(runner)
 print(label,len(m),flush=True)
