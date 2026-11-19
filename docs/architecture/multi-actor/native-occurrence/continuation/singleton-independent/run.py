from pathlib import Path
import os,sys,subprocess,json
p=Path(__file__).parent;arm=sys.argv[1];env=dict(os.environ,PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+os.environ['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_SINGLETON_ALLOCATION_OUTPUT=str(p/(arm+'-allocation.jsonl')))
base=['corepack','pnpm','nx','test','kernel','--skip-nx-cache'];runs=[('controls',base+['singleton-row-reuse.spec.ts','singleton-row-allocation.spec.ts','--maxWorkers=1']),('point',base+['entity-granular-reactivity.spec.ts','--testNamePattern=a single-entity update does not rebuild','--maxWorkers=1'])];results=[]
for name,cmd in runs:
 with (p/(arm+'-'+name+'.log')).open('w') as log:r=subprocess.run(cmd,cwd=p/arm,env=env,stdout=log,stderr=subprocess.STDOUT)
 results.append({'command':cmd,'cwd':str(p/arm),'exit':r.returncode,'allocationOutput':env['ST_SINGLETON_ALLOCATION_OUTPUT']});(p/(arm+'-commands.json')).write_text(json.dumps(results,indent=2)+'\n');print(arm,name,r.returncode,flush=True)
