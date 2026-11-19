from pathlib import Path
import subprocess,json,hashlib,gzip,collections
root=Path('/Users/jonathanborgia/code/signaltree'); out=Path('/private/tmp/st-c21-reproducibility-audit');arc=root/'docs/architecture/multi-actor/native-occurrence'
h=lambda b:hashlib.sha256(b).hexdigest()
manifest=json.loads(Path('/private/tmp/st-native-combined-c21/SNAPSHOT-C21.json').read_text())
(out/'TARGET.json').write_text(json.dumps(manifest,indent=2)+'\n')
pool={}; origin={}
def add(b,src):
 d=h(b)
 if d not in pool:pool[d]=b;origin[d]=src
for ref in ['HEAD','87f6831f']:
 tree=subprocess.check_output(['git','ls-tree','-r','-z',ref],cwd=root).split(b'\0')
 proc=subprocess.Popen(['git','cat-file','--batch'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
 n=0
 for line in tree:
  if not line:continue
  info,path=line.split(b'\t',1);mode,typ,oid=info.split()
  if typ!=b'blob':continue
  proc.stdin.write(oid+b'\n');proc.stdin.flush();header=proc.stdout.readline();size=int(header.split()[2]);b=proc.stdout.read(size);proc.stdout.read(1)
  add(b,'git:'+ref+':'+path.decode());n+=1
 proc.stdin.close();proc.wait();print(ref,n,flush=True)
patches=[]; stats=collections.Counter()
for f in arc.rglob('*'):
 if not f.is_file():continue
 b=f.read_bytes();stats['files']+=1
 if f.suffix=='.gz':
  try:b=gzip.decompress(b);stats['gzip']+=1
  except:continue
 add(b,str(f.relative_to(root)))
 if f.name.endswith(('.patch','.diff','.patch.gz','.diff.gz')):patches.append((str(f.relative_to(root)),b))
missing={k:v for k,v in manifest.items() if v not in pool}
(out/'DIRECT-MISSING.json').write_text(json.dumps(missing,indent=2)+'\n')
(out/'DIRECT-COVERAGE.json').write_text(json.dumps({k:origin[v] for k,v in manifest.items() if v in pool},indent=2)+'\n')
print('archive',dict(stats),'patches',len(patches),'directmissing',len(missing),flush=True)
# Archive pool used by separate patch closure; bytes never obtained from candidate.
import pickle
(out/'pool.pkl').write_bytes(pickle.dumps((pool,origin,patches)))
