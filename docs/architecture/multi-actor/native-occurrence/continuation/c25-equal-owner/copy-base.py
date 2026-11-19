from pathlib import Path
import hashlib,json,shutil
r=Path('/private/tmp/st-c25-equal-owner');b=Path('/private/tmp/st-c24-equal-owner');c=r/'candidate';c.mkdir();manifest=json.loads((b/'SNAPSHOT-FROZEN.json').read_text());assert hashlib.sha256((b/'SNAPSHOT-FROZEN.json').read_bytes()).hexdigest()=='cb54add521dafd9ec875b87d6c19f85de38e4b56d0c79c147a7c3c3e41306bcd'
for rel,h in manifest.items():
 src=b/'candidate'/rel;data=src.read_bytes();assert hashlib.sha256(data).hexdigest()==h,rel;dst=c/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data);shutil.copymode(src,dst)
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copy2(b/'SNAPSHOT-FROZEN.json',r/'BASE-MANIFEST.json');shutil.copy2(b/'run-focused.py',r/'run-focused.py');p=r/'run-focused.py';s=p.read_text().replace('/private/tmp/st-c24-equal-owner','/private/tmp/st-c25-equal-owner');p.write_text(s)
(r/'BASE-VERIFIED.json').write_text(json.dumps({'files':len(manifest),'sha256':'cb54add521dafd9ec875b87d6c19f85de38e4b56d0c79c147a7c3c3e41306bcd'},indent=2)+'\n');print('copied verified',len(manifest))
