from pathlib import Path
import os,subprocess,json
h=Path(__file__).resolve().parent;c=h/'candidate';results=[]
for arm in ['drop-proceed','hold-proceed']:
 name='nx-target-'+arm;env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NODE_OPTIONS='--expose-gc',NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',ST_GC_ARM=arm,ST_GC_OUTPUT=str(h/(name+'.json')))
 cmd=['corepack','pnpm','nx','run','held-continuation-probe:retention','--skip-nx-cache']
 with (h/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
 result={'arm':arm,'exit':r.returncode,'command':cmd};results.append(result);print(json.dumps(result),flush=True)
 if r.returncode:break
(h/'NX-TARGET-RUNS.json').write_text(json.dumps(results,indent=2))
