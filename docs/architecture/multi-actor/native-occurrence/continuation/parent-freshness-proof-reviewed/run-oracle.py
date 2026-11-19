from pathlib import Path
import sys,os,json,subprocess,hashlib
p=Path(__file__).parent;c=p/'oracle';name=sys.argv[1];argv=sys.argv[2:];d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False);(d/'observations').mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'oracle-nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'oracle-nx-data'),ST_PREPARED_REVIEW_OUTPUT=str(d/'observations'))
def identity():
 return {str(f.relative_to(c)):hashlib.sha256(f.read_bytes()).hexdigest() for f in (c/'packages').rglob('*.ts') if 'node_modules' not in f.parts}
before=identity();(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2))
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','ST_PREPARED_REVIEW_OUTPUT']}},indent=2))
with (d/'first.log').open('w') as f:r=subprocess.run(argv,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'sourceUnchangedDuringRun':before==identity()},indent=2));print(name,r.returncode,flush=True)
