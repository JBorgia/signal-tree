from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json
w=Path('/private/tmp/st-c28-r3-reader-memory');r=w/'R1';id=json.loads((r/'IDENTITY.json').read_text());tasks=[];groups={}
for arm,info in id['inputs'].items():
 for variant,root,manifest in [('frozen',Path(info['frozenPath']),w/(arm+'-FROZEN-MANIFEST.json')),('measurement',Path(info['measurementPath']),w/arm/'MANIFEST.json')]:
  key=arm+'-'+variant;m=json.loads(manifest.read_text());excluded='packages/kernel/src/lib/entity-large-batches.spec.ts' if variant=='measurement' else None
  groups[key]={'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'checkedFiles':len(m)-(1 if excluded else 0),'excludedOverlay':excluded,'mismatches':[]}
  for path,expected in m.items():
   if path!=excluded:tasks.append((key,root/path,path,expected))
def check(x):
 key,p,path,expected=x
 try:actual=hashlib.sha256(p.read_bytes()).hexdigest()
 except Exception as e:actual=str(e)
 return key,path,actual==expected
with ThreadPoolExecutor(max_workers=4) as pool:
 for key,path,good in pool.map(check,tasks):
  if not good:groups[key]['mismatches'].append(path)
for arm,last in [('baseline','baseline-2048-r1'),('reader','reader-512-r1')]:
 p=Path(id['inputs'][arm]['measurementPath'])/'packages/kernel/src/lib/entity-large-batches.spec.ts';snapshot=r/'runs'/last/'TEST.spec.ts';groups[arm+'-measurement']['overlayMatchesLastRun']=p.read_bytes()==snapshot.read_bytes()
Path('/private/tmp/st-c28-r3-preparation-reader-review/MEMORY-R1-SOURCE-CHECK.json').write_text(json.dumps(groups,indent=2)+'\n');print(json.dumps(groups,indent=2))
