from pathlib import Path
import json,hashlib,tarfile,shutil,datetime
p=Path(__file__).resolve().parent;c=Path('/private/tmp/st-v16-integration-candidate');old=Path('/private/tmp/st-v16-test-doc-composition');s=Path('/private/tmp/st-test-sink-lint-correction');sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest();base=json.loads((old/'MANIFEST.json').read_text());review=json.loads((s/'HASHES.json').read_text())
for name in ['full-angular','full-react','full-vue','full-solid']:
 r=json.loads((old/'runs'/name/'RESULT.json').read_text());assert not r['remainingOwned'] and not r['sourceMismatches'] and not r['guardReason']
assert all(sha(c/n)==h for n,h in base.items())
assert sha(old/'MANIFEST.json')=='cae244793913aa51ffe36848a8ba3f6e77af24185323a6141ba6c66a03a5876f'
with tarfile.open(p/'cae-source.tar','x') as t:
 for n in sorted(base):t.add(c/n,arcname=n,recursive=False)
for row in review['files']:
 n=row['file'];assert base.get(n)==row['before_sha256']
 if row['overlay_sha256']:assert sha(s/'overlay'/n)==row['overlay_sha256']
 else:assert n in (s/'DELETIONS.txt').read_text().splitlines()
for row in review['files']:
 n=row['file']
 if row['overlay_sha256']:(c/n).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s/'overlay'/n,c/n)
 else:(c/n).unlink()
new={n:sha(c/n) for n in sorted(set(base)|{r['file'] for r in review['files']}) if (c/n).is_file()};changes={r['file'] for r in review['files']};assert all(new[n]==h for n,h in base.items() if n not in changes)
assert sha(c/'packages/kernel/test/optional-diagnostic.ts')==base['tools/testing/optional-diagnostic.ts']
(p/'MANIFEST.json').write_text(json.dumps(new,indent=2)+'\n');shutil.copy2(old/'MANIFEST.json',p/'BASE-MANIFEST.json')
(p/'COMPOSITION.json').write_text(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidate':str(c),'baseManifest':sha(old/'MANIFEST.json'),'manifestSha256':sha(p/'MANIFEST.json'),'sourceFiles':len(new),'delta':review['files'],'productionTypeScriptDelta':[],'SDKConfigBudgetDelta':[],'preservedArchiveSha256':sha(p/'cae-source.tar'),'dependentFrameworkReceipts':str(old/'runs'),'incompleteKernelNotCredited':str(old/'KERNEL-INCOMPLETE.json'),'patchSha256':sha(s/'lint-correction.patch')},indent=2)+'\n')
for name in ['run.py','guarded-run.py']:shutil.copy2(old/name,p/name)
print('NEW MANIFEST',sha(p/'MANIFEST.json'),len(new))
