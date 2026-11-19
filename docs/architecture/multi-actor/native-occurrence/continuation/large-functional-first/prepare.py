from pathlib import Path
import json,hashlib,shutil,difflib
p=Path(__file__).resolve().parent;c=Path('/private/tmp/st-v16-integration-candidate');d=p/'screen-candidate';m=json.loads(Path('/private/tmp/st-v16-integration-evidence/MANIFEST.json').read_text());d.mkdir()
for n,h in m.items():
 f=c/n;assert hashlib.sha256(f.read_bytes()).hexdigest()==h,n
 t=d/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,t)
(d/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
files=['packages/kernel/src/lib/entity-large-batches.spec.ts','packages/kernel/src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts'];patch=''
for n in files:
 f=d/n;s=f.read_text();assert s.count('const LARGE = 130_000;')==1;v=s.replace('const LARGE = 130_000;','const LARGE = 2_048;');f.write_text(v);patch+=''.join(difflib.unified_diff(s.splitlines(True),v.splitlines(True),fromfile='a/'+n,tofile='b/'+n))
new={n:hashlib.sha256((d/n).read_bytes()).hexdigest() for n in m};assert [n for n in m if m[n]!=new[n]]==sorted(files)
for name,obj in [('CANDIDATE-MANIFEST.json',m),('SCREEN-MANIFEST.json',new)]: (p/name).write_text(json.dumps(obj,indent=2)+'\n')
(p/'screen.patch').write_text(patch)
reporter=Path('/private/tmp/st-c28-r3-reader-memory/full-reporter.mjs').read_text();(p/'reporter.mjs').write_text(reporter.replace('at:Date.now(),...row','at:Date.now(),monotonicNs:process.hrtime.bigint().toString(),reporterPid:process.pid,...row'))
cases=[('membership',files[0],'entity batches larger than the argument limit','setAll, replace and clear with membership observed',60000),('replacement-undo-redo',files[0],'entity batches larger than the argument limit','undo and redo of a setAll that replaced every row',120000),('restoration-jumps',files[1],'v16 restoration of turns larger than the argument limit','jumps across a turn that cleared more rows than the argument limit',120000),('restoration-truncation',files[1],'v16 restoration of turns larger than the argument limit','releases the claims of a truncated turn that cleared more rows than the argument limit',120000)]
commands=[]
for arm,root in [('screen',d),('original',c)]:
 for label,file,suite,name,timeout in cases:
  commands.append({'id':arm+'-'+label,'arm':arm,'cwd':str(root),'file':file,'expectedName':suite+' > '+name,'originalTestTimeoutMs':timeout,'argv':['corepack','pnpm','nx','test','kernel',file.removeprefix('packages/kernel/'),'--testNamePattern=^'+suite+' '+name+'$','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(p/'reporter.mjs')]})
(p/'COMMANDS.json').write_text(json.dumps(commands,indent=2)+'\n')
(p/'IDENTITY.json').write_text(json.dumps({'candidate':str(c),'candidateManifest':hashlib.sha256((p/'CANDIDATE-MANIFEST.json').read_bytes()).hexdigest(),'screen':str(d),'screenManifest':hashlib.sha256((p/'SCREEN-MANIFEST.json').read_bytes()).hexdigest(),'delta':files,'originalsUntouched':True},indent=2)+'\n')
print((p/'IDENTITY.json').read_text())
