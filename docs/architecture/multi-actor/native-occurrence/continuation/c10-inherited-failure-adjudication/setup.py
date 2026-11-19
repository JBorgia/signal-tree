from pathlib import Path
import hashlib,json,shutil,subprocess
p=Path(__file__).parent;deps=p.parent/'candidate/node_modules';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();result={}
for side,root,mname in [('candidate',Path('/private/tmp/st-native-combined-c10-promoted'),'SNAPSHOT.json'),('oracle',Path('/private/tmp/st-native-combined-c8a'),'SNAPSHOT-C8a.json')]:
 mf=root/mname;m=json.loads(mf.read_text());dst=p/side;dst.mkdir();bad=[]
 assert h(root/'candidate/pnpm-lock.yaml')==h(p.parent/'candidate/pnpm-lock.yaml')
 for n,v in m.items():
  src=root/'candidate'/n
  if h(src)!=v:bad.append(n)
  target=dst/n;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target)
 assert not bad,(side,bad)
 shutil.copy2(mf,p/(side+'-MANIFEST.json'));result[side]={'source':str(root/'candidate'),'manifest':str(mf),'manifestSha256':h(mf),'verifiedFiles':len(m),'lockSHA256':h(dst/'pnpm-lock.yaml')}
 subprocess.run(['cp','-cR',str(deps),str(dst/'node_modules')],check=True)
 for bindir in (dst/'node_modules').rglob('.bin'):
  for f in bindir.iterdir():
   if f.is_file() and not f.is_symlink():
    b=f.read_bytes();s=b.replace(str(deps).encode(),str(dst/'node_modules').encode())
    if s!=b:f.write_bytes(s)
 print(side,'ready',flush=True)
(p/'IDENTITY.json').write_text(json.dumps(result,indent=2))
