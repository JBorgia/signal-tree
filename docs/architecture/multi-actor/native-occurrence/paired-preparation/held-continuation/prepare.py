from pathlib import Path
import json,hashlib,shutil
h=Path(__file__).resolve().parent;b=Path('/private/tmp/st-prepared-paired-successor/candidate');m=b.parent/'SOURCE-SHA256.json';s=json.loads(m.read_text())
assert all(hashlib.sha256((b/k).read_bytes()).hexdigest()==v for k,v in s.items())
shutil.copytree(b,h/'candidate',symlinks=True,ignore=shutil.ignore_patterns('node_modules','.git','.nx','dist','coverage'));(h/'candidate/node_modules').symlink_to((b/'node_modules').resolve(),target_is_directory=True)
shutil.copy2(m,h/'SOURCE-SHA256.json')
