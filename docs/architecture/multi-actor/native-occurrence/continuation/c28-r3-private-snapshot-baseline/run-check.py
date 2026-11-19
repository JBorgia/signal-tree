from pathlib import Path
import os,subprocess,json,sys
r=Path(__file__).resolve().parent;name=sys.argv[1];d=r/'runs'/name;d.mkdir(exist_ok=False);(d/'tmp').mkdir();env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'data'),TMPDIR=str(d/'tmp'),ST_SNAPSHOT_OUTPUT=str(d/'observations.jsonl'))
args=sys.argv[2:];(d/'COMMAND.json').write_text(json.dumps({'argv':args,'cwd':str(r/'candidate'),'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k=='TMPDIR'}},indent=2))
with (d/'first.log').open('w') as f:p=subprocess.run(args,cwd=r/'candidate',env=env,stdout=f,stderr=subprocess.STDOUT)
(d/'EXIT').write_text(str(p.returncode)+'\n');print(name,p.returncode)
