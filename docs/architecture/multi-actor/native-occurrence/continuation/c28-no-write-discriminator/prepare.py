from pathlib import Path
import hashlib,json,shutil
r=Path('/private/tmp/st-c28-no-write-discriminator');b=Path('/private/tmp/st-c27-public-composition');c=r/'candidate';c.mkdir();p=b/'SNAPSHOT-C27.json';assert hashlib.sha256(p.read_bytes()).hexdigest()=='bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd';m=json.loads(p.read_text())
for rel,h in m.items():
 src=b/'candidate'/rel;data=src.read_bytes();assert hashlib.sha256(data).hexdigest()==h;dst=c/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data);shutil.copymode(src,dst)
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True);shutil.copy2(p,r/'BASE-MANIFEST.json');(r/'run-focused.py').write_text((b/'run-focused.py').read_text().replace(str(b),str(r)))
print('Exact C27 copied',len(m))
