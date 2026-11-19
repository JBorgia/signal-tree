from pathlib import Path
import hashlib,json,subprocess,difflib
r=Path.cwd(); evidence=r/'proof-evidence'; old=Path('/private/tmp/st-selected-projection-repair')
sha='87f6831fa60cafe87508f0ace84b7638698ca3b0'; manifest=json.loads((old/'repair-evidence/archive-manifest.json').read_text())
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
changed=[p for p,v in manifest.items() if (r/p).is_file() and h(r/p)!=v]
new=sorted(str(p.relative_to(r)) for p in (r/'packages').rglob('*') if p.is_file() and str(p.relative_to(r)) not in manifest and 'node_modules' not in p.parts)
base=evidence/'patch-base';base.mkdir(exist_ok=True)
sourcepatch=[];testpatch=[]
for name in sorted(changed+new):
 p=r/name
 before=subprocess.check_output(['git','show',f'{sha}:{name}'],cwd='/Users/jonathanborgia/code/signaltree').decode() if name in manifest else ''
 if name in manifest:
  b=base/name;b.parent.mkdir(parents=True,exist_ok=True);b.write_text(before)
 patch=''.join(difflib.unified_diff(before.splitlines(True),p.read_text().splitlines(True),fromfile='a/'+name if name in manifest else '/dev/null',tofile='b/'+name))
 (testpatch if '.spec.' in name else sourcepatch).append(patch)
(evidence/'source.patch').write_text(''.join(sourcepatch));(evidence/'tests.patch').write_text(''.join(testpatch));(evidence/'candidate.patch').write_text(''.join(sourcepatch+testpatch))
prior=json.loads((old/'repair-evidence/FINAL-HASHES.json').read_text());assert all(h(old/p)==v for p,v in prior.items())
identity={'commit':sha,'tree':'10e6be502fda139bb16ab7a72c426efc86ce8888','archiveSha256':'f68758a1fda1ccb3198098f97d1f0c4b254ce2def039c602d291b2deb72595ad','changedArchiveFiles':changed,'addedPackageFiles':new,'priorEvidenceHashesVerified':len(prior),'files':{p:h(r/p) for p in sorted(changed+new)},'patches':{n:h(evidence/n) for n in ['source.patch','tests.patch','candidate.patch']}}
(evidence/'SOURCE-IDENTITY.json').write_text(json.dumps(identity,indent=2)+'\n')
print(json.dumps({'changed':changed,'new':new,'patches':identity['patches']},indent=2))
