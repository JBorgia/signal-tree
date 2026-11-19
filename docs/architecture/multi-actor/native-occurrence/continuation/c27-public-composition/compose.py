from pathlib import Path
import hashlib,json,shutil,subprocess,difflib
r=Path('/private/tmp/st-c27-public-composition');b=Path('/private/tmp/st-c26-scalar-finalized-role');p=Path('/private/tmp/st-c23-declare-public-successor');c=r/'candidate';c.mkdir()
inputs=[(b,'SNAPSHOT-C26.json','8055911bdd78c9df536bc8a7e1ea8bf3e74427c64675fbc8d0a566c0d91aa38f'),(p,'SNAPSHOT-CANDIDATE.json','081e2114166b06506da5ea4e9b25544de8f4b2214b9fd16e93a0ad2423d35aaa')];verified=[]
for root,name,h in inputs:
 mfile=root/name;assert hashlib.sha256(mfile.read_bytes()).hexdigest()==h;m=json.loads(mfile.read_text())
 for rel,sha in m.items():
  src=root/'candidate'/rel;data=src.read_bytes();assert hashlib.sha256(data).hexdigest()==sha,rel
  if root==b:
   dst=c/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(data);shutil.copymode(src,dst)
 verified.append({'source':str(root/'candidate'),'manifest':name,'sha256':h,'verifiedFiles':len(m)})
(r/'INPUT-IDENTITIES.json').write_text(json.dumps(verified,indent=2)+'\n');shutil.copy2(b/'SNAPSHOT-C26.json',r/'BASE-MANIFEST.json');(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
patches={}
for name,expected in [('public-surface.patch','818d99835b6bc58e80728655cb97098dbc76634a43e3ae3992fc26a51c89df2e'),('internal-type-tightening.patch','d66239834bd87fee0688031d0b8cbfb33cd11ea4aaaf134201d63c531eaf2e84'),('public-tests.patch','45d3a7d990047050b19e51635713646593ba482acf9eb8066edb05bd59fd4b61')]:
 src=p/name;sha=hashlib.sha256(src.read_bytes()).hexdigest()
 # Reviewed bytes are also saved verbatim; exact candidate comparison follows.
 assert sha==expected
 shutil.copy2(src,r/name);result=subprocess.run(['git','apply','--verbose',str(r/name)],cwd=c,capture_output=True,text=True)
 (r/(name+'.apply.log')).write_text(result.stdout+result.stderr);patches[name]={'sha256':sha,'exit':result.returncode}
 (r/'PATCH-APPLICATION.json').write_text(json.dumps(patches,indent=2)+'\n')
 if result.returncode:raise SystemExit(result.returncode)
for name in ['run-focused.py','run-direct.py']:(r/name).write_text((b/name).read_text().replace(str(b),str(r)))
base=json.loads((r/'BASE-MANIFEST.json').read_text());paths=set(base)
for patch in patches:
 for line in (r/patch).read_text().splitlines():
  if line.startswith('+++ b/'):paths.add(line[6:])
changed=[];diff=''
for rel in sorted(paths):
 data=(c/rel).read_bytes();old=(b/'candidate'/rel).read_bytes() if rel in base else b''
 if data!=old:
  changed.append(rel)
  if old:
   dst=r/'originals'/rel;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes(old)
  diff+=''.join(difflib.unified_diff(old.decode().splitlines(True),data.decode().splitlines(True),fromfile='a/'+rel if old else '/dev/null',tofile='b/'+rel))
(r/'composition.patch').write_text(diff);manifest={rel:hashlib.sha256((c/rel).read_bytes()).hexdigest() for rel in sorted(paths)}
(r/'SNAPSHOT-C27.json').write_text(json.dumps(manifest,indent=2)+'\n')
(r/'FREEZE.json').write_text(json.dumps({'status':'Frozen composition; focused qualification pending','manifestSha256':hashlib.sha256((r/'SNAPSHOT-C27.json').read_bytes()).hexdigest(),'compositionPatchSha256':hashlib.sha256((r/'composition.patch').read_bytes()).hexdigest(),'changedFromC26':changed,'merge':'All three reviewed patches applied without conflict; no manual merge/source edits','activation':'No activation/default-gating edits; inherited C26 behavior retained'},indent=2)+'\n');print((r/'FREEZE.json').read_text())
