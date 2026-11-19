from pathlib import Path
import hashlib,json,shutil,difflib
p=Path(__file__).resolve().parent
base=Path('/private/tmp/st-c28-r3-reader-test-composition/candidate');c=Path('/private/tmp/st-v16-integration-candidate')
m=json.loads(Path('/private/tmp/st-c28-r3-reader-verification/BASE-MANIFEST.json').read_text());c.mkdir()
for n,h in m.items():
 f=base/n;data=f.read_bytes();assert hashlib.sha256(data).hexdigest()==h,n
 dest=c/n;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(p/'BASE-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n')
def change(n,fn):
 f=c/n;old=f.read_text();new=fn(old);assert old!=new;f.write_text(new)
change('packages/kernel/src/lib/internals/entity-preparation-reader.ts',lambda s:"import { isTraversableNode } from './node-shape';\n\n"+s.replace("node === null || (typeof node !== 'object' && typeof node !== 'function')","!isTraversableNode(node)"))
change('packages/kernel/src/lib/preparation-reader-comparison.spec.ts',lambda s:s.replace('changeId(){},removeOne(){}','changeId(){return undefined;},removeOne(){return undefined;}'))
def cold(s):
 helper='''function expectNoRetainedFacades(
  inventories: readonly (EntitySubjectPhysicalInventory<string> | undefined)[]
): void {
  for (const inventory of inventories) {
    if (inventory === undefined) continue;
    expect(inventory.nodeFacadeMaterialized).toBe(false);
    expect(inventory.fieldFacadesMaterialized).toEqual([]);
  }
}
'''
 s=s.replace('function watch(',helper+'function watch(')
 s=s.replace("h.setPhase('undo'); tree.undo(); h.setPhase('off'); await drain();", "h.setPhase('undo'); tree.undo(); h.setPhase('off');\n      const afterUndo = currentHandles.map(h.inventory);\n      expectNoRetainedFacades(afterUndo);\n      await drain();")
 s=s.replace("      const afterUndo = currentHandles.map(h.inventory);\n      h.setPhase('redo'); tree.redo(); h.setPhase('off'); await drain();", "      h.setPhase('redo'); tree.redo(); h.setPhase('off');\n      const afterRedo = currentHandles.map(h.inventory);\n      expectNoRetainedFacades(afterRedo);\n      await drain();")
 s=s.replace("      const afterRedo = currentHandles.map(h.inventory);\n      h.setPhase('late-field');", "      h.setPhase('late-field');")
 s=s.replace('const afterInspection = currentHandles.map(h.inventory);','const afterInspection = currentHandles.map(h.inventory);\n      expectNoRetainedFacades(afterInspection);')
 s=s.replace("h.setPhase('rollback'); pending.rollback(); settled = true; h.setPhase('off'); await drain();", "h.setPhase('rollback'); pending.rollback(); settled = true; h.setPhase('off');\n      const afterRollback = currentHandles.map(h.inventory);\n      expectNoRetainedFacades(afterRollback);\n      await drain();")
 s=s.replace("      const afterRollback = currentHandles.map(h.inventory);\n      tree.$.rows.updateOne", "      tree.$.rows.updateOne")
 return s
change('packages/kernel/src/lib/cold-row-responsibility.spec.ts',cold)
new={n:hashlib.sha256((c/n).read_bytes()).hexdigest() for n in m}
identity=hashlib.sha256(json.dumps(new,sort_keys=True,separators=(',',':')).encode()).hexdigest()
delta=[n for n in m if m[n]!=new[n]]
(p/'MANIFEST.json').write_text(json.dumps(new,indent=2)+'\n')
(p/'IDENTITY.json').write_text(json.dumps({'candidate':str(c),'manifest':identity,'manifestAlgorithm':'sha256(JSON sorted keys compact separators)','base':'0af649ba10c55e784d95ae323dcde8322ba018e465110c2a70a36ea2d4cb3949','files':len(new),'delta':delta,'dependencyReuse':'explicit node_modules symlink; no cache or dist copy'},indent=2)+'\n')
patch=''.join(''.join(difflib.unified_diff((base/n).read_text().splitlines(True),(c/n).read_text().splitlines(True),fromfile='a/'+n,tofile='b/'+n)) for n in delta)
(p/'successor.patch').write_text(patch)
runner=Path('/private/tmp/st-c28-r3-reader-verification/run.py').read_text().replace("c=Path('/private/tmp/st-c28-r3-reader-test-composition/candidate')","c=Path(os.environ.get('ST_VERIFICATION_CANDIDATE','/private/tmp/st-v16-integration-candidate'))")
(p/'run.py').write_text(runner)
print((p/'IDENTITY.json').read_text())
