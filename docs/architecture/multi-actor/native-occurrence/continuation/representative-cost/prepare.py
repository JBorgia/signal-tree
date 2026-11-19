from pathlib import Path
import subprocess,json,hashlib,shutil,datetime
p=Path(__file__).resolve().parent;repo=Path('/Users/jonathanborgia/code/signaltree');rev='87f6831fa60cafe87508f0ace84b7638698ca3b0';c=p/'retained';c.mkdir();sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
subprocess.run(['git','archive','--format=tar','--output='+str(p/'retained-source.tar'),rev],cwd=repo,check=True)
subprocess.run(['tar','-xf',str(p/'retained-source.tar'),'-C',str(c)],check=True)
paths=subprocess.check_output(['git','ls-tree','-r','--name-only','-z',rev],cwd=repo).decode().strip('\0').split('\0');m={}
for n in sorted(paths):
 f=c/n;assert f.is_file() and not f.is_symlink(),n;m[n]=sha(f)
(p/'RETAINED-MANIFEST.json').write_text(json.dumps(m,indent=2)+'\n');(c/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
selected=Path('/private/tmp/st-v16-integration-candidate');base=selected/'docs/audits/2026-10-17-incumbent-readiness/representative-cost';(p/'harness').mkdir()
for n in ['child.mjs','child-heap-v2.mjs','heap-quiescence.mjs']:shutil.copy2(base/n,p/'harness'/n);assert sha(base/n)==sha(p/'harness'/n)
shutil.copy2('/private/tmp/st-v16-integration-evidence/MANIFEST.json',p/'SELECTED-MANIFEST.json')
config=['package.json','pnpm-lock.yaml','.nvmrc','nx.json','tsconfig.base.json','packages/kernel/rollup.custom.mjs','packages/kernel/project.json']
comparison={n:{'retained':sha(c/n),'selected':sha(selected/n),'identical':sha(c/n)==sha(selected/n)} for n in config}
assert json.loads((c/'packages/kernel/project.json').read_text())['targets']['build']==json.loads((selected/'packages/kernel/project.json').read_text())['targets']['build']
r={'preparedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'retainedCommit':rev,'retainedSource':str(c),'retainedSourceFiles':len(m),'retainedManifestSha256':sha(p/'RETAINED-MANIFEST.json'),'gitArchiveSha256':sha(p/'retained-source.tar'),'selectedSource':str(selected),'selectedManifestSha256':sha(p/'SELECTED-MANIFEST.json'),'configComparison':comparison,'buildTargetIdentical':True,'projectDifference':'selected adds diagnostic-replay target only','dependencies':'both arms explicitly resolve the same existing root node_modules; no copied cache archives','harness':{n:sha(p/'harness'/n) for n in ['child.mjs','child-heap-v2.mjs','heap-quiescence.mjs']},'oldRunner':'not copied/executed; old hardcoded paths and27-profile schedule excluded','costChildrenLaunched':0};(p/'PREPARATION.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
# Existing bounded command supervisor for setup only; workload180s controller is registered separately.
s=Path('/private/tmp/st-v16-integration-evidence/run.py').read_text().replace("'/private/tmp/st-v16-integration-candidate'",repr(str(c)));(p/'setup-run.py').write_text(s)
