from pathlib import Path
import json,hashlib,re,os,difflib,shutil
b=Path('/private/tmp/st-test-sink-lint-correction');s=Path('/private/tmp/st-v16-integration-candidate');c=Path('/private/tmp/st-v16-test-doc-composition')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(c/'MANIFEST.json')=='cae244793913aa51ffe36848a8ba3f6e77af24185323a6141ba6c66a03a5876f'
m=json.loads((c/'MANIFEST.json').read_text())
files=[f for f in m if f.endswith('.spec.ts') and (s/f).is_file() and re.search(r"import .*from '[^']*tools/testing/optional-diagnostic'",(s/f).read_text())];assert len(files)==14
old='tools/testing/optional-diagnostic.ts';new='packages/kernel/test/optional-diagnostic.ts';assert not (s/new).exists()
fixes={
'independent-dynamic-enrollment.spec.ts':('},()=>{});','},()=>{ /* This refusal probe needs no membership completion work. */ });'),
'independent-prepared-boundary.spec.ts':('complete(){}','complete(){ /* Packet capture happens during preparation only. */ }'),
'recipient-window-review.spec.ts':('set:()=>{}','set:()=>{ /* This connection supplies the declaration without recording deliveries. */ }'),
'rich-capture-getter-boundary.spec.ts':('opaque:()=>{}','opaque:()=>{ /* Callable row data is deliberately inert in this getter probe. */ }'),
'rich-capture-participant-boundary.spec.ts':('complete(){}','complete(){ /* This fixture observes preparation, not completion. */ }'),
'rich-source-preparation-boundary.spec.ts':('complete(){}','complete(){ /* This fixture observes preparation, not completion. */ }'),
}
for f in files+[old]:
 assert sha(s/f)==m[f],f
 p=b/'before'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((s/f).read_bytes())
for f in files:
 text=(s/f).read_text();target=os.path.relpath(new[:-3],os.path.dirname(f))
 text,n=re.subn(r"(?<=from ')[^']*tools/testing/optional-diagnostic(?=')",target,text);assert n==1
 if Path(f).name in fixes:
  a,z=fixes[Path(f).name];assert text.count(a)==1,f;text=text.replace(a,z)
 p=b/'overlay'/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
p=b/'overlay'/new;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((s/old).read_bytes())
(b/'DELETIONS.txt').write_text(old+'\n')
patch=[];records=[]
for f in sorted(files+[old,new]):
 before=b/'before'/f;after=b/'overlay'/f
 patch.extend(difflib.unified_diff(before.read_text().splitlines(True) if before.exists() else [],after.read_text().splitlines(True) if after.exists() else [],fromfile='a/'+f if before.exists() else '/dev/null',tofile='b/'+f if after.exists() else '/dev/null'))
 records.append({'file':f,'before_sha256':sha(before) if before.exists() else None,'overlay_sha256':sha(after) if after.exists() else None})
(b/'lint-correction.patch').write_text(''.join(patch))
evidence=[]
for rel in ['LINT-FIRST-CLASSIFICATION.json','runs/affected-lint/first.log','runs/affected-lint/COMMAND.json','runs/affected-lint/RESULT.json','runs/affected-lint/EXIT']:
 p=b/'preserved-lint'/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((c/rel).read_bytes());evidence.append({'source':str(c/rel),'copy':str(p.relative_to(b)),'sha256':sha(p)})
(b/'HASHES.json').write_text(json.dumps({'source':str(s),'base_manifest_sha256':sha(c/'MANIFEST.json'),'patch_sha256':sha(b/'lint-correction.patch'),'files':records,'preserved_lint':evidence},indent=2)+'\n')
print('Prepared 14 import edits, 6 comment-only callback edits, and byte-identical helper relocation. First lint failure preserved.')
