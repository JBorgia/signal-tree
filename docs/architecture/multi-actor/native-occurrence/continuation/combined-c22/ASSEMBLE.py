from pathlib import Path
import json,hashlib,shutil
base=Path('/private/tmp/st-native-combined-c21'); arm=Path('/private/tmp/st-c21-point-bounded-alternatives'); out=Path('/private/tmp/st-native-combined-c22');out.mkdir(exist_ok=False);dst=out/'candidate';dst.mkdir()
m=json.loads((base/'SNAPSHOT-C21.json').read_text()); a=json.loads((arm/'SNAPSHOT-A.json').read_text()); selected='packages/kernel/src/lib/experimental-publication/private.ts'
for name,digest in m.items():
 source=base/'candidate'/name;assert hashlib.sha256(source.read_bytes()).hexdigest()==digest,name
 p=dst/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,p)
source=arm/'A'/selected;assert hashlib.sha256(source.read_bytes()).hexdigest()==a[selected];shutil.copy2(source,dst/selected)
(dst/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
final={name:hashlib.sha256((dst/name).read_bytes()).hexdigest() for name in m};assert [name for name in m if m[name]!=final[name]]==[selected]
(out/'SNAPSHOT-C22.json').write_text(json.dumps(final,indent=2)+'\n');(out/'COMPOSITION.json').write_text(json.dumps({'baseManifest':str(base/'SNAPSHOT-C21.json'),'incomingManifest':str(arm/'SNAPSHOT-A.json'),'selectedRuntimeOnly':selected,'before':m[selected],'after':a[selected],'excludedResearchTests':True},indent=2)+'\n')
runner=(base/'run-isolated.py').read_text();start=runner.index('def source_identity():');end=runner.index('\nbefore=source_identity()',start)
runner=runner[:start]+"def source_identity():\n paths=json.loads((root/'SNAPSHOT-C22.json').read_text())\n return {p:hashlib.sha256((root/'candidate'/p).read_bytes()).hexdigest() for p in paths}\n"+runner[end:]
(out/'run.py').write_text(runner);(out/'diagnostic-redirect.cjs').write_text((base/'diagnostic-redirect.cjs').read_text().replace('st-native-combined-c21','st-native-combined-c22'))
print(hashlib.sha256((out/'SNAPSHOT-C22.json').read_bytes()).hexdigest())
