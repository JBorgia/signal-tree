from pathlib import Path
import hashlib,json,shutil,subprocess,difflib,re
r=Path('/private/tmp/st-c28-r3-composition-independent');p=Path('/private/tmp/st-c28-r3-composition');base=Path('/private/tmp/st-c28-r3-comparator/candidate');meta=Path('/private/tmp/st-c28-r3-realization-metadata-repair');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((p/'MANIFEST.json').read_text());layers=json.loads((p/'COMPOSITION.json').read_text());expected=json.loads((Path('/private/tmp/st-c28-r3-comparator/MANIFEST.json')).read_text());audit=[]
for row in layers:
 f=row['path'];assert row.get('beforeSha256',row.get('baseSha256'))==expected.get(f),(f,'chain mismatch');expected[f]=row['sha256'];audit.append({'path':f,'kind':row['kind'],'sourceHashMatches':h(Path(row['from']))==row['sha256'] if 'from' in row else None})
assert m==expected,'unlisted composition change'
for f,v in m.items():
 assert h(p/'candidate'/f)==v,f
 q=r/'candidate'/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p/'candidate'/f,q)
(r/'candidate/node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
(r/'SOURCE-MANIFEST.json').write_bytes((p/'MANIFEST.json').read_bytes());(r/'COMPOSITION.json').write_bytes((p/'COMPOSITION.json').read_bytes())
# Reconstruct actual three-way source composition independent of Main merge output.
mm=json.loads((meta/'MANIFEST.json').read_text());bm=json.loads(Path('/private/tmp/st-c28-r3-comparator/MANIFEST.json').read_text());merges=[]
for f,v in mm.items():
 if bm.get(f)==v:continue
 before=p/'candidate'/f
 prior=next((Path(x['from']) for x in reversed(layers[:next(i for i,x in enumerate(layers) if x['path']==f and x['kind']=='reviewed-realization-metadata-three-way-composition')]) if x['path']==f),base/f)
 if not (base/f).exists():merged=(meta/'candidate'/f).read_text();conflicts=0
 else:
  result=subprocess.run(['git','merge-file','-p',str(prior),str(base/f),str(meta/'candidate'/f)],capture_output=True,text=True);assert result.returncode in [0,1],result.stderr;merged=result.stdout;conflicts=merged.count('<<<<<<<')
  if conflicts:
   def resolve(match):
    a,b=match.group(1),match.group(2);assert all(line.startswith('import ') for line in (a+b).splitlines()),(f,a,b);return a+b
   merged=re.sub(r'<<<<<<<[^\n]*\n(.*?)=======\n(.*?)>>>>>>>[^\n]*\n',resolve,merged,flags=re.S)
 if merged!=before.read_text():
  (r/('merge-diff-'+Path(f).name)).write_text(''.join(difflib.unified_diff(merged.splitlines(True),before.read_text().splitlines(True))));raise Exception('merge mismatch '+f)
 merges.append({'path':f,'importConflictsResolved':conflicts,'exactMatch':True})
(r/'LAYER-AUDIT.json').write_text(json.dumps({'manifest':h(p/'MANIFEST.json'),'layers':audit,'metadataManifest':h(meta/'MANIFEST.json'),'reconstructedMerges':merges},indent=2)+'\n')
s=Path('/private/tmp/st-c28-r3-disposition-index/run-diagnostic.py').read_text().replace("b=Path('/private/tmp/st-c28-r3-disposition-index')","b=Path('/private/tmp/st-c28-r3-composition-independent')");(r/'run.py').write_text(s)
print('verified',len(m),'and',len(layers),'layers')
