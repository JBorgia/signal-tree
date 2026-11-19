from pathlib import Path
import hashlib,json,shutil,difflib
p=Path(__file__).parent;r=Path('/private/tmp/st-c27-public-composition');m=r/'SNAPSHOT-C27.json';manifest=json.loads(m.read_text());dest=p/'c27-copy';dest.mkdir(exist_ok=True)
for f,h in manifest.items():
 src=r/'candidate'/f;b=src.read_bytes();assert hashlib.sha256(b).hexdigest()==h,f
 d=dest/f;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes(b);shutil.copymode(src,d)
(dest/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
original=Path('/private/tmp/st-c23-row-react-declaration-qualification/candidate/packages/kernel/src/lib/direct-row-declaration-qualification.spec.ts');rel='packages/kernel/src/lib/'+original.name;assert rel not in manifest
(p/'originals').mkdir(exist_ok=True);shutil.copy2(original,p/'originals'/original.name);shutil.copy2(original,dest/rel)
new='packages/kernel/src/lib/entity-declaration-useful-lifecycle.spec.ts';assert new not in manifest;shutil.copy2(p/'packet'/new,dest/new)
(p/'C27-MANIFEST.json').write_bytes(m.read_bytes())
(p/'IDENTITY.json').write_text(json.dumps({'source':str(r/'candidate'),'manifestSHA256':hashlib.sha256(m.read_bytes()).hexdigest(),'verifiedFiles':len(manifest),'overlays':{f:hashlib.sha256((dest/f).read_bytes()).hexdigest() for f in [rel,new]},'originalROW23':str(original),'dependencies':'symlink root node_modules'},indent=2)+'\n')
(p/'TESTS.patch').write_text(''.join(difflib.unified_diff([], (p/'packet'/new).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+new)))
print((p/'IDENTITY.json').read_text())
