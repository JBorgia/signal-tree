from pathlib import Path
import os,json,hashlib,gzip,sys
base=Path('/Users/jonathanborgia/code/signaltree/docs/architecture/multi-actor/native-occurrence/continuation')
for pair in sys.argv[1:]:
 label,source=pair.split('=',1);src=Path(source);dst=base/label;dst.mkdir(exist_ok=True);records=[]
 for directory,dirs,files in os.walk(src,followlinks=False):
  dirs[:]=[d for d in dirs if d not in {'candidate','node_modules','incomplete-node_modules','tmp','nx-data','nx-cache','.nx','.git','dist','coverage','__pycache__','baseline','successor','c0-check','raw','three-way'} and not (Path(directory)/d/'packages/kernel/package.json').is_file() and not (Path(directory)/d).is_symlink()]
  for name in files:
   p=Path(directory)/name
   if p.is_symlink() or p.suffix in {'.gz','.zip','.tar'}:continue
   raw=p.read_bytes();rel=p.relative_to(src);target=dst/rel;data=raw
   if len(raw)>100000:target=target.with_name(target.name+'.gz');data=gzip.compress(raw,mtime=0)
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
   records.append({'source':str(rel),'archive':str(target.relative_to(dst)),'sourceSha256':hashlib.sha256(raw).hexdigest(),'archiveSha256':hashlib.sha256(data).hexdigest()})
 (dst/'ARCHIVE-MAP.json').write_text(json.dumps(records,indent=2)+'\n');print(label,len(records))
