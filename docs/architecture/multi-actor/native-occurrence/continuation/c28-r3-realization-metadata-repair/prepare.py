from pathlib import Path
import json,hashlib,shutil
root=Path(__file__).parent;base=Path('/private/tmp/st-c28-r3-comparator');m=json.loads((base/'MANIFEST.json').read_text());(root/'BASE-MANIFEST.json').write_bytes((base/'MANIFEST.json').read_bytes())
for arm in ['candidate','baseline']:
 dest=root/arm
 for f,h in m.items():
  src=base/'candidate'/f;b=src.read_bytes();assert hashlib.sha256(b).hexdigest()==h,f
  out=dest/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(b);shutil.copymode(src,out)
 (dest/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
originals=root/'originals';originals.mkdir()
for f in ['packages/kernel/src/enhancers/transactions/transaction-safety.spec.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.spec.ts']:
 src=base/'candidate'/f
 if src.exists():shutil.copy2(src,originals/src.name)
shutil.copytree('/private/tmp/st-c28-r3-state-repair/runs',root/'prior-state-runs')
print('verified/copied',len(m),'files per arm')
