from pathlib import Path
import json,hashlib,difflib,subprocess
p=Path(__file__).parent;c=p/'candidate';base=Path('/private/tmp/st-native-combined-c8/candidate');m=json.loads((p/'BASE-SOURCE.json').read_text())
paths=set(m)|{str(f.relative_to(c)) for f in (c/'packages').rglob('*.ts') if 'node_modules' not in f.parts}
manifest={n:hashlib.sha256((c/n).read_bytes()).hexdigest() for n in sorted(paths)}
(p/'SNAPSHOT-PROOF.json').write_text(json.dumps(manifest,indent=2)+'\n')
parts=[];runtime=[];changed=[]
for n in sorted(paths):
 if manifest[n]==m.get(n):continue
 changed.append(n);before=(base/n).read_text().splitlines(True) if n in m else [];after=(c/n).read_text().splitlines(True)
 delta=''.join(difflib.unified_diff(before,after,fromfile='a/'+n if n in m else '/dev/null',tofile='b/'+n))
 parts.append(delta)
 if '.spec.' not in n:runtime.append(delta)
(p/'FROM-C8.patch').write_text(''.join(parts));(p/'RUNTIME.patch').write_text(''.join(runtime))
check=p/'patch-check';check.mkdir()
for n in changed:
 if n in m:
  d=check/n;d.parent.mkdir(parents=True,exist_ok=True);d.write_bytes((base/n).read_bytes())
cmd=['git','apply',str(p/'FROM-C8.patch')];r=subprocess.run(cmd,cwd=check,capture_output=True,text=True);assert r.returncode==0,r.stderr
assert all((check/n).read_bytes()==(c/n).read_bytes() for n in changed)
(p/'PATCH-ROUNDTRIP.json').write_text(json.dumps({'argv':cmd,'exit':r.returncode,'changedFiles':len(changed),'allAppliedBytesMatch':True},indent=2)+'\n')
commands={f.parent.name:json.loads(f.read_text()) for f in sorted((p/'runs').glob('*/COMMAND.json'))};(p/'COMMANDS.json').write_text(json.dumps(commands,indent=2)+'\n')
freeze={'baseManifestSha256':hashlib.sha256((p/'BASE-SOURCE.json').read_bytes()).hexdigest(),'manifestSha256':hashlib.sha256((p/'SNAPSHOT-PROOF.json').read_bytes()).hexdigest(),'manifestFiles':len(manifest),'changedBaselineFiles':[n for n in changed if n in m],'newFiles':[n for n in changed if n not in m],'runtimePatchSha256':hashlib.sha256((p/'RUNTIME.patch').read_bytes()).hexdigest(),'combinedPatchSha256':hashlib.sha256((p/'FROM-C8.patch').read_bytes()).hexdigest(),'status':'bounded proof frozen for independent review; no activation or release claim'}
(p/'FREEZE.json').write_text(json.dumps(freeze,indent=2)+'\n')
files=[]
for f in p.rglob('*'):
 if not f.is_file():continue
 rel=f.relative_to(p)
 if any(x in rel.parts for x in ['candidate','oracle','patch-check','nx-cache','nx-data','oracle-nx-cache','oracle-nx-data']):continue
 if f.name=='EVIDENCE-SHA256.json':continue
 files.append(f)
(p/'EVIDENCE-SHA256.json').write_text(json.dumps({str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(files)},indent=2)+'\n')
print(json.dumps(freeze,indent=2))
