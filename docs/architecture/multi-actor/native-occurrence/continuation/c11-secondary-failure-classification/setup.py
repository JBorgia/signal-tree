from pathlib import Path
import hashlib,json,shutil,subprocess
p=Path(__file__).parent;prior=p.parent/'full-run-classification';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();result={}
for side,source,manifest in [('candidate',Path('/private/tmp/st-native-combined-c11/candidate'),Path('/private/tmp/st-native-combined-c11/SNAPSHOT-COUNTERPARTS.json')),('oracle',Path('/private/tmp/st-native-combined-c8a/candidate'),Path('/private/tmp/st-native-combined-c8a/SNAPSHOT-C8a.json'))]:
 m=json.loads(manifest.read_text());subprocess.run(['cp','-cR',str(prior/side),str(p/side)],check=True)
 for n,v in m.items():
  src=source/n;assert h(src)==v,(side,n,'frozen mismatch')
  dst=p/side/n
  if not dst.is_file() or h(dst)!=v:
   dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
  assert h(dst)==v,n
 shutil.copy2(manifest,p/(side+'-MANIFEST.json'));result[side]={'source':str(source),'manifest':str(manifest),'sha256':h(manifest),'files':len(m),'dependencies':str((p/side/'node_modules').resolve()),'lock':h(p/side/'pnpm-lock.yaml')}
 print(side,'ready',flush=True)
(p/'IDENTITY.json').write_text(json.dumps(result,indent=2)+'\n')
shutil.copy2(prior/'run.py',p/'run.py')
