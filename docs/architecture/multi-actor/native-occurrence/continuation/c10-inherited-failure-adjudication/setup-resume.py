from pathlib import Path
import hashlib,json,shutil
p=Path(__file__).parent;deps=p.parent/'candidate/node_modules';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();result={}
nm=p/'candidate/node_modules'
if nm.exists():nm.rename(p/'aborted-dependency-copy')
for side,root,mname in [('candidate',Path('/private/tmp/st-native-combined-c10-promoted'),'SNAPSHOT.json'),('oracle',Path('/private/tmp/st-native-combined-c8a'),'SNAPSHOT-C8a.json')]:
 mf=root/mname;m=json.loads(mf.read_text());dst=p/side;dst.mkdir(exist_ok=True)
 assert h(root/'candidate/pnpm-lock.yaml')==h(p.parent/'candidate/pnpm-lock.yaml')
 for n,v in m.items():
  src=root/'candidate'/n;assert h(src)==v,n
  target=dst/n;target.parent.mkdir(parents=True,exist_ok=True)
  if not target.exists():shutil.copy2(src,target)
  assert h(target)==v,n
 shutil.copy2(mf,p/(side+'-MANIFEST.json'));(dst/'node_modules').symlink_to(deps,target_is_directory=True)
 result[side]={'source':str(root/'candidate'),'manifest':str(mf),'manifestSha256':h(mf),'verifiedFiles':len(m),'dependencies':str(deps),'lockSHA256':h(dst/'pnpm-lock.yaml')}
(p/'IDENTITY.json').write_text(json.dumps(result,indent=2));print('Both source copies verified; dependencies isolated within reviewer-owned directory')
