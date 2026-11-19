from pathlib import Path
import os,sys,json,subprocess,time,hashlib
p=Path(__file__).resolve().parent;name,label,*args=sys.argv[1:];out=p/'runs'/name;out.mkdir(parents=True,exist_ok=False)
for d in ['tmp','nx-cache','nx-data','observations']:(out/d).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/label/'.nx-task-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/label/'.nx-task-data'),TMPDIR=str(out/'tmp'),ST_PREPARED_REVIEW_OUTPUT=str(out/'observations'),ST_POINT_DIAGNOSTIC_OUTPUT=str(out/'observations'))
env['ST_INPUT_SOURCE']=str(p/label/'packages/kernel/src/lib/experimental-publication/private.ts')
argv=['corepack','pnpm',*args];(out/'COMMAND.json').write_text(json.dumps({'cwd':str(p/label),'argv':argv,'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k in ['PATH','TMPDIR']}},indent=2))
paths=set(json.loads((p/'BASE-MANIFEST.json').read_text()))|{'packages/kernel/src/lib/singleton-input-controls.spec.ts','packages/kernel/src/lib/point-work-attribution.spec.ts'}
def hashes():return {f:hashlib.sha256((p/label/f).read_bytes()).hexdigest() for f in sorted(paths)}
before=hashes();(out/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2))
with (out/'first.log').open('w') as log:r=subprocess.run(argv,cwd=p/label,env=env,stdout=log,stderr=subprocess.STDOUT)
result={'exit':r.returncode,'sourceUnchanged':before==hashes()};(out/'RESULT.json').write_text(json.dumps(result,indent=2));print(name,result,flush=True);sys.exit(r.returncode)
