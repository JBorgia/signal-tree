from pathlib import Path
import os,sys,subprocess,json
p=Path(__file__).parent;name,side,kind,*args=sys.argv[1:];d=p/'runs'/name;d.mkdir(parents=True)
e=os.environ.copy();e.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+e['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/(side+'-cache')),NX_WORKSPACE_DATA_DIRECTORY=str(p/(side+'-data')),COREPACK_ENABLE_NETWORK='0')
a=['corepack','pnpm','nx','test','kernel',*args,'--skip-nx-cache','--maxWorkers=1'] if kind=='test' else ['node','tools/check-spec-types.mjs']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(p/side),'argv':a,'env':{k:v for k,v in e.items() if k.startswith(('NX_','COREPACK_')) or k=='PATH'}},indent=2))
with (d/'first.log').open('w') as f:r=subprocess.run(a,cwd=p/side,env=e,stdout=f,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));print(name,r.returncode)
