from pathlib import Path
import json,hashlib,shutil,difflib
p=Path(__file__).parent;m=json.loads(Path('/private/tmp/st-c27-public-composition/SNAPSHOT-C27.json').read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();records={}
for label,src in [('c27',Path('/private/tmp/st-c27-public-composition/candidate')),('c28',Path('/private/tmp/st-c28-current-certificate/candidate'))]:
 dst=p/(label+'-copy');dst.mkdir();before={f:h(src/f) for f in m}
 if label=='c27':assert before==m
 for f in m:
  d=dst/f;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src/f,d)
 assert before=={f:h(src/f) for f in m},'source changed during capture'
 assert before=={f:h(dst/f) for f in m}
 (dst/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
 (p/(label+'-MANIFEST.json')).write_text(json.dumps(before,indent=2)+'\n');records[label]={'source':str(src),'files':len(before),'manifestSha256':h(p/(label+'-MANIFEST.json'))}
changes=[f for f in m if h(p/'c27-copy'/f)!=h(p/'c28-copy'/f)]
(p/'CAPTURE.json').write_text(json.dumps({'sources':records,'changedFromC27':changes,'scope':'all C27 manifest paths; author extra unmanifested fixtures excluded'},indent=2)+'\n')
with (p/'CAPTURED-DIFF.patch').open('w') as out:
 for f in changes:
  try:a=(p/'c27-copy'/f).read_text();b=(p/'c28-copy'/f).read_text()
  except UnicodeDecodeError:continue
  out.writelines(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile='a/'+f,tofile='b/'+f))
print(json.dumps(records));print(changes)
