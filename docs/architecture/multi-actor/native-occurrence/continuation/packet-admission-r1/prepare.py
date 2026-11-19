from pathlib import Path
import os,json,hashlib,shutil
root=Path('/private/tmp/st-packet-index-admission-r1');src=Path('/private/tmp/st-packet-index-successor/candidate')
excluded={'.git','node_modules','.nx','dist','coverage'}
manifest={};links={}
for base,dirs,files in os.walk(src):
 dirs[:]=sorted(d for d in dirs if d not in excluded and not (Path(base)/d).is_symlink())
 for name in sorted(files):
  f=Path(base)/name;rel=str(f.relative_to(src))
  if f.is_symlink():links[rel]=os.readlink(f)
  else:manifest[rel]=hashlib.sha256(f.read_bytes()).hexdigest()
data=json.dumps(manifest,indent=2,sort_keys=True)+'\n';(root/'BASE-SOURCE-SHA256.json').write_text(data)
(root/'BASELINE.json').write_text(json.dumps({'source':str(src),'manifestSHA256':hashlib.sha256(data.encode()).hexdigest(),'files':len(manifest),'excludedDirectories':sorted(excluded),'fileSymlinks':links,'git':'snapshot has no .git; no HEAD/branch available'},indent=2)+'\n')
shutil.copytree(src,root/'candidate',symlinks=True,ignore=shutil.ignore_patterns(*excluded))
# dependencies are borrowed read-only from the frozen snapshot
os.symlink(os.path.realpath(src/'node_modules'),root/'candidate/node_modules')
print(len(manifest),hashlib.sha256(data.encode()).hexdigest())
