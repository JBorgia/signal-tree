from pathlib import Path
import subprocess,json,hashlib,pickle
p=Path('/private/tmp/st-c21-reproducibility-audit');m=json.loads((p/'TARGET.json').read_text());pool={};origin={}
proc=subprocess.Popen(['git','cat-file','--batch'],cwd='/Users/jonathanborgia/code/signaltree',stdin=subprocess.PIPE,stdout=subprocess.PIPE)
count=0
for line in (p/'git-reachable-objects.txt').read_text().splitlines():
 pair=line.split(' ',1)
 if len(pair)!=2 or pair[1] not in m:continue
 oid,path=pair;proc.stdin.write((oid+'\n').encode());proc.stdin.flush();header=proc.stdout.readline().split();size=int(header[2]);b=proc.stdout.read(size);proc.stdout.read(1)
 if header[1]!=b'blob':continue
 d=hashlib.sha256(b).hexdigest();pool[d]=b;origin[d]='git-object:'+oid+':'+path;count+=1
proc.stdin.close();proc.wait()
(p/'git-extra.pkl').write_bytes(pickle.dumps((pool,origin)))
print(count,'blobs',len(pool),'unique',sum(map(len,pool.values())),'bytes',flush=True)
