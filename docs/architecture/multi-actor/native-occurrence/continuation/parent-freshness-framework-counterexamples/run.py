import os,sys,json,subprocess
from pathlib import Path
p=Path(__file__).parent
name,candidate,*args=sys.argv[1:]
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true')
cmd=['corepack','pnpm',*args]
(p/(name+'-command.json')).write_text(json.dumps({'cwd':str(p/candidate),'cmd':cmd,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_NO_CLOUD','CI']}},indent=2))
with (p/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=p/candidate,env=env,stdout=f,stderr=subprocess.STDOUT)
(p/(name+'-exit.json')).write_text(json.dumps({'exit':r.returncode}));print((p/(name+'.log')).read_text()[-4500:])
