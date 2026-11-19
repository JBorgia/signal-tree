from pathlib import Path
import json,hashlib,shutil
p=Path(__file__).resolve().parent
base=json.loads(Path('/private/tmp/st-retained-source-controls/BASE-SOURCE-SHA256.json').read_text())
for label,origin in [('candidate','st-row-source-successor'),('predecessor','st-entity-anchor-successor')]:
 src=Path('/private/tmp')/origin/'candidate';dst=p/label
 paths=set(base)|{str(f.relative_to(src)) for f in (src/'packages').rglob('*.ts') if 'node_modules' not in f.parts}
 manifest={}
 for rel in sorted(paths):
  f=src/rel
  if not f.is_file():continue
  data=f.read_bytes();manifest[rel]=hashlib.sha256(data).hexdigest();o=dst/rel;o.parent.mkdir(parents=True,exist_ok=True);o.write_bytes(data)
 (dst/'node_modules').symlink_to((src/'node_modules').resolve(),target_is_directory=True)
 (p/(label+'-SOURCE-SHA256.json')).write_text(json.dumps(manifest,indent=2)+'\n')
a=json.loads((p/'predecessor-SOURCE-SHA256.json').read_text());b=json.loads((p/'candidate-SOURCE-SHA256.json').read_text());(p/'DELTA.json').write_text(json.dumps({r:{'before':a.get(r),'after':b.get(r)} for r in sorted(set(a)|set(b)) if a.get(r)!=b.get(r)},indent=2)+'\n')
shutil.copy2('/private/tmp/st-retained-source-controls/run.py',p/'run.py')
print((p/'DELTA.json').read_text())
