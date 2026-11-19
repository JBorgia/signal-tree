from pathlib import Path
import hashlib,json,shutil,difflib
out=Path(__file__).parent
ids={}
for version,folder,mname in [('C25','st-c25-equal-owner','SNAPSHOT-C25.json'),('C26','st-c26-scalar-finalized-role','SNAPSHOT-C26.json')]:
 r=Path('/private/tmp')/folder;m=r/mname;manifest=json.loads(m.read_text());dest=out/(version.lower()+'-copy');dest.mkdir(exist_ok=True)
 records={}
 for f,h in manifest.items():
  src=r/'candidate'/f;b=src.read_bytes();actual=hashlib.sha256(b).hexdigest()
  if actual!=h:raise RuntimeError((version,f,'source hash mismatch'))
  target=dest/f;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);shutil.copymode(src,target);records[f]=h
 (dest/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
 rel='packages/kernel/src/lib/scalar-horizon-lifecycle-controls.spec.ts';shutil.copy2(out/'packet'/rel,dest/rel)
 ids[version]={'source':str(r/'candidate'),'manifest':str(m),'manifestSha256':hashlib.sha256(m.read_bytes()).hexdigest(),'verifiedFiles':len(records),'copy':str(dest),'overlay':rel,'overlaySha256':hashlib.sha256((dest/rel).read_bytes()).hexdigest(),'sourceFiles':records}
 (out/(version+'-MANIFEST.json')).write_bytes(m.read_bytes())
(out/'SOURCE-IDENTITY.json').write_text(json.dumps(ids,indent=2)+'\n')
rel='packages/kernel/src/lib/scalar-horizon-lifecycle-controls.spec.ts';b=(out/'packet'/rel).read_text();(out/'TESTS.patch').write_text(''.join(difflib.unified_diff([],b.splitlines(True),fromfile='/dev/null',tofile='b/'+rel)))
prior=out/'C25-preserved';prior.mkdir(exist_ok=True)
for src in [Path('/private/tmp/st-c25-equal-owner/research/ROOTS-DERIVED.jsonl'),Path('/private/tmp/st-c25-equal-owner/runs/roots-derived/first.log')]:shutil.copy2(src,prior/src.name)
print(json.dumps({v:{k:a[k] for k in ['manifestSha256','verifiedFiles','overlaySha256']} for v,a in ids.items()}))
