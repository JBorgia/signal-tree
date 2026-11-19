from pathlib import Path
import pickle,json,re,hashlib,collections
p=Path('/private/tmp/st-c21-reproducibility-audit');pool,origin,patches=pickle.loads((p/'pool.pkl').read_bytes());target=json.loads((p/'TARGET.json').read_text())
h=lambda b:hashlib.sha256(b).hexdigest()
extra,extraorig=pickle.loads((p/'git-extra.pkl').read_bytes());pool.update(extra);origin.update(extraorig)
expected=set(target.values())
for data in pool.values():
 if data[:1] in (b'{',b'['):expected.update(x.decode() for x in re.findall(rb'\b[0-9a-f]{64}\b',data))
variants=collections.defaultdict(set)
for d,o in origin.items():variants[Path(o.removesuffix('.gz')).name].add(d)
sections=[]
for name,data in patches:
 lines=data.splitlines(keepends=True);i=0
 while i<len(lines):
  if not lines[i].startswith(b'--- ') or i+1>=len(lines) or not lines[i+1].startswith(b'+++ '):i+=1;continue
  before=lines[i][4:].decode().strip().split('\t')[0];after=lines[i+1][4:].decode().strip().split('\t')[0];i+=2;chunks=[]
  while i<len(lines):
   m=re.match(rb'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@',lines[i])
   if not m:break
   start=int(m[1]);oldcount=int(m[2] or b'1');newcount=int(m[4] or b'1');i+=1;old=[];new=[];oc=nc=0
   while i<len(lines) and (oc<oldcount or nc<newcount):
    l=lines[i];i+=1
    if l[:1] in (b' ',b'-'):old.append(l[1:]);oc+=1
    if l[:1] in (b' ',b'+'):new.append(l[1:]);nc+=1
   chunks.append((start,old,new))
   if i<len(lines) and lines[i].startswith(b'\\ No newline'):i+=1
  if chunks:sections.append((name,before,after,chunks))
  # retain progress when diff --git/index lines appear
attempts=set();derived={};rounds=[]
for turn in range(35):
 count=0
 for idx,(name,before,after,chunks) in enumerate(sections):
  newfile=before=='/dev/null' or (len(chunks)==1 and chunks[0][0]==0 and not chunks[0][1])
  candidates={h(b'')} if newfile else set(variants[Path(before).name])
  if newfile:pool[h(b'')]=b''
  for d in candidates:
   if (idx,d) in attempts:continue
   attempts.add((idx,d));src=pool[d].splitlines(keepends=True);result=[];last=0;good=True
   for start,old,new in chunks:
    pos=max(start-1,0)
    if pos<last or src[pos:pos+len(old)]!=old:good=False;break
    result.extend(src[last:pos]);result.extend(new);last=pos+len(old)
   if not good:continue
   result.extend(src[last:]);b=b''.join(result);out=h(b)
   if out not in pool and out in expected:
    pool[out]=b;origin[out]='patch:'+name;derived[out]={'patch':name,'before':d,'path':after};variants[Path(after).name].add(out);count+=1
 rounds.append(count);print('round',turn,count,flush=True)
 if not count:break
print('sections',len(sections),'rounds',rounds,'derived',len(derived))
missing={k:v for k,v in target.items() if v not in pool}
(p/'PATCH-CLOSURE-MISSING.json').write_text(json.dumps(missing,indent=2)+'\n')
(p/'PATCH-CLOSURE-COVERAGE.json').write_text(json.dumps({k:origin[v] for k,v in target.items() if v in pool},indent=2)+'\n')
(p/'PATCH-DERIVATIONS.json').write_text(json.dumps(derived,indent=2)+'\n')
(p/'closure-pool.pkl').write_bytes(pickle.dumps((pool,origin,patches)))
print('missing',len(missing),collections.Counter(k.split('/')[0] for k in missing))
