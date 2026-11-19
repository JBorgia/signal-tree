from pathlib import Path
import json,hashlib,shutil,difflib
r=Path('/private/tmp/st-c26-scalar-finalized-role');o=Path('/private/tmp/st-c27-owner-history');c=o/'candidate';m=json.loads((r/'SNAPSHOT-C26.json').read_text());c.mkdir(exist_ok=True)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for rel,v in m.items():
 src=r/'candidate'/rel;assert h(src)==v,rel;dst=c/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(o/'BASE-MANIFEST.json').write_text((r/'SNAPSHOT-C26.json').read_text())
changes={
'packages/kernel/src/lib/experimental-publication/private.ts':'''\n// Independent read-only owner-history diagnostics.\nexport function __historyRoots(node:object){return {endpoint:nativeValues.get(node),view:nativeViews.get(node),bindings:[...bindings.values()]};}\nexport function __historyFactRoot(value:object){return factRequirements.get(value as Fact);}\n''',
'packages/kernel/src/lib/experimental-publication/lifecycle.ts':'''\n// Expose only existing weak edges for the diagnostic graph walker.\nexport function __historyWeakRoots(value:object){return [finalizedRetirements.get(value as NativeRequirement),requirementListeners.get(value as NativeRequirement),ownerTransitionObservers.get(value as OwnerCell)];}\n'''}
patch=''
for rel,extra in changes.items():
 p=c/rel;before=p.read_text();p.write_text(before+extra);patch+=''.join(difflib.unified_diff(before.splitlines(True),(before+extra).splitlines(True),fromfile='a/'+rel,tofile='b/'+rel))
(o/'INSTRUMENTATION.patch').write_text(patch);(o/'PREPARATION.json').write_text(json.dumps({'baseManifestSha256':h(r/'SNAPSHOT-C26.json'),'copiedEntries':len(m),'instrumentedFiles':list(changes),'copyMatchesExceptInstrumentation':all(h(c/rel)==v for rel,v in m.items() if rel not in changes)},indent=2)+'\n')
