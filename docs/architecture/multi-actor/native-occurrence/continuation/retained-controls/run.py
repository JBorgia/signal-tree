from pathlib import Path
import subprocess,os,json,sys
p=Path(__file__).resolve().parent;c=p/os.environ.get('CONTROL_COPY','candidate');name=sys.argv[1];args=sys.argv[2:]
assert not (p/(name+'.log')).exists()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
with (p/(name+'.log')).open('w') as f:r=subprocess.run(args,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
(p/(name+'.exit')).write_text(str(r.returncode)+'\n');(p/(name+'.command.json')).write_text(json.dumps({'cwd':str(c),'command':args,'exit':r.returncode},indent=2));print(name,r.returncode,flush=True)
