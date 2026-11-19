from pathlib import Path
import shutil,subprocess,os,json
h=Path(__file__).resolve().parent;c=h/'candidate'
shutil.copy2(h/'probe.spec.ts',c/'packages/kernel/src/lib/held-continuation-probe.spec.ts');shutil.copy2(h/'retention-probe.config.ts',c/'packages/kernel/retention-probe.config.ts')
results=[]
for arm in ['drop-proceed','hold-proceed','hold-row']:
 for rep in [1,2]:
  name=f'{arm}-{rep}';env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NODE_OPTIONS='--expose-gc',ST_GC_ARM=arm,ST_GC_OUTPUT=str(h/(name+'.json')))
  cmd=['corepack','pnpm','exec','vitest','run','--root','packages/kernel','--config','retention-probe.config.ts']
  with (h/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
  results.append({'arm':arm,'rep':rep,'exit':r.returncode,'command':cmd});print(json.dumps(results[-1]),flush=True)
  if r.returncode:break
 if results[-1]['exit']:break
(h/'RUNS.json').write_text(json.dumps(results,indent=2))
