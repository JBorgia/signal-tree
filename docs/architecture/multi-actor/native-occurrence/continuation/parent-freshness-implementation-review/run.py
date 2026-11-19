from pathlib import Path
import os,sys,subprocess,json,hashlib
p=Path(__file__).parent; name=sys.argv[1];side=sys.argv[2];args=sys.argv[3:];c=p/side; d=p/'runs'/name;d.mkdir(parents=True);(d/'observations').mkdir(exist_ok=True)
e=os.environ.copy();e.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+e['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/(side+'-cache')),NX_WORKSPACE_DATA_DIRECTORY=str(p/(side+'-data')),ST_PREPARED_REVIEW_OUTPUT=str(d/'observations'))
a=['corepack','pnpm','nx','test']+args+['--skip-nx-cache','--maxWorkers=1']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':a,'env':{k:v for k,v in e.items() if k.startswith(('NX_','ST_'))}},indent=2))
with (d/'first.log').open('w') as f:r=subprocess.run(a,cwd=c,env=e,stdout=f,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));print(name,r.returncode)
