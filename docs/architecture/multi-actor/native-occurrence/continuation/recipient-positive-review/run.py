from pathlib import Path
import json,os,subprocess,hashlib
p=Path(__file__).resolve().parent;d=p/'run';d.mkdir();c=p/'candidate'
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'nx-data'),TMPDIR=str(d/'tmp'));(d/'tmp').mkdir()
cmd=['corepack','pnpm','nx','test','kernel','recipient-progress-positive-counterparts.spec.ts','recipient-source-permission.spec.ts','recipient-cause-classification.spec.ts','--skip-nx-cache','--maxWorkers=1']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'cmd':cmd,'env':{k:v for k,v in env.items() if k.startswith('NX_') or k in ['PATH','TMPDIR']}},indent=2))
with (d/'first.log').open('w') as out:r=subprocess.run(cmd,cwd=c,env=env,stdout=out,stderr=subprocess.STDOUT,timeout=180)
m=json.loads((p/'INPUT-MANIFEST.json').read_text());unchanged=all(hashlib.sha256((c/f).read_bytes()).hexdigest()==h for f,h in m.items());result={'exit':r.returncode,'sourceUnchanged':unchanged};(d/'RESULT.json').write_text(json.dumps(result,indent=2));print(result)
