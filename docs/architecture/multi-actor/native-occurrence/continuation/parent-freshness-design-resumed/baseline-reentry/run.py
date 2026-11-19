from pathlib import Path
import os,subprocess,json,hashlib
p=Path(__file__).parent;c=p/'candidate';manifest=json.loads(Path('/private/tmp/st-native-combined-c7a/SNAPSHOT-C7a.json').read_text())
def verify():
 return [n for n,h in manifest.items() if hashlib.sha256((c/n).read_bytes()).hexdigest()!=h]
assert not verify()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'))
for facade in ['kernel','angular']:
 d=p/'runs'/facade;d.mkdir(parents=True);o=d/'observations';o.mkdir();env['ST_PREPARED_REVIEW_OUTPUT']=str(o)
 argv=['corepack','pnpm','nx','test',facade,'--skip-nx-cache','bounded-reentry-baseline.spec.ts','--maxWorkers=1']
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','ST_PREPARED_REVIEW_OUTPUT']}},indent=2)+'\n')
 with (d/'first.log').open('w') as f:r=subprocess.run(argv,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
 (d/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'baselineChanged':verify()},indent=2)+'\n');print(facade,r.returncode,flush=True)
