import os,sys,subprocess,json
from pathlib import Path
p=Path(__file__).resolve().parent;stage=sys.argv[1];out=p/stage;out.mkdir();env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(out/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(out/'data'),TMPDIR=str(out/'tmp'));(out/'tmp').mkdir();env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.pop('NODE_OPTIONS',None);cmd=['node',str(p/'graph.cjs'),str(out/'graph.json')];(out/'COMMAND.json').write_text(json.dumps({'cmd':cmd,'cwd':str(p/'candidate'),'env':{k:v for k,v in env.items() if k.startswith('NX_') or k in ['PATH','TMPDIR']}},indent=2));
with (out/'first.log').open('w') as f:r=subprocess.run(cmd,cwd=p/'candidate',env=env,stdout=f,stderr=subprocess.STDOUT)
(out/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));print(stage,r.returncode)
