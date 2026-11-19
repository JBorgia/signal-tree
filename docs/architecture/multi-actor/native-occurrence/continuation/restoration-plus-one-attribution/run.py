from pathlib import Path
import json,os,hashlib,subprocess
p=Path(__file__).resolve().parent;d=p/'run';d.mkdir(exist_ok=False)
for name in ['tmp','nx-cache','nx-data','observations']:(d/name).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'nx-data'),TMPDIR=str(d/'tmp'),ST_TRACE_OUTPUT=str(d/'observations'))
argv=['corepack','pnpm','nx','test','kernel','restoration-extra-paired.spec.ts','restoration-extra-large-sequence.spec.ts','--skip-nx-cache','--maxWorkers=1']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(p/'candidate'),'argv':argv,'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k in ['PATH','TMPDIR']}},indent=2))
paths=set(json.loads((p/'BASE-MANIFEST.json').read_text()))|{str(f.relative_to(p/'candidate')) for f in (p/'candidate/packages/kernel/src/lib').glob('restoration-extra-*.spec.ts')}
def hashes():return {f:hashlib.sha256((p/'candidate'/f).read_bytes()).hexdigest() for f in sorted(paths)}
before=hashes();(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2))
with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=p/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT)
result={'exit':r.returncode,'sourceUnchanged':before==hashes()};(d/'RESULT.json').write_text(json.dumps(result,indent=2));print(result)
