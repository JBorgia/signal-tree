from pathlib import Path
import shutil,json,hashlib,os
p=Path('/private/tmp/st-fixed-window-retirement-independent');author=Path('/private/tmp/st-fixed-window-retirement-successor');src=author/'candidate';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();m=json.loads((author/'SOURCE-SHA256.json').read_text());assert all(h(src/k)==v for k,v in m.items());(p/'SOURCE-SHA256.json').write_text(json.dumps(m,indent=2,sort_keys=True)+'\n')
shutil.copytree(src,p/'candidate',symlinks=True,ignore=shutil.ignore_patterns('.git','node_modules','.nx','dist','coverage'));os.symlink(os.path.realpath(src/'node_modules'),p/'candidate/node_modules')
f=p/'candidate/packages/kernel/src/lib/fixed-window-retirement.spec.ts';s=f.read_text().replace('/private/tmp/st-fixed-window-retirement-successor/provenance-',str(p)+'/provenance-');f.write_text(s)
(p/'IDENTITY.json').write_text(json.dumps({'author':str(author),'manifestSHA256':h(author/'SOURCE-SHA256.json'),'files':len(m),'runtimePatchSHA256':h(author/'runtime.patch'),'redirectedOutputOnly':'packages/kernel/src/lib/fixed-window-retirement.spec.ts','authorFreeze':json.loads((author/'FREEZE.json').read_text())},indent=2)+'\n')
