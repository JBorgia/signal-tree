from pathlib import Path
import subprocess,os,sys
p=Path(__file__).resolve().parent
runs=[]
runs += [('typed-extended-'+scenario+'-'+arm,'extended',arm,scenario) for scenario in ['success','skip','caught'] for arm in ['drop-proceed','hold-proceed']]
runs += [('typed-explicit-value','extended','hold-value','success')]
for name,target,arm,scenario in runs:
 env=os.environ.copy();env.update(NODE_OPTIONS='--expose-gc',ST_GC_ARM=arm,ST_GC_SCENARIO=scenario,ST_GC_OUTPUT=str(p/(name+'.json')))
 r=subprocess.run([sys.executable,str(p/'run-gates.py'),name,'corepack','pnpm','nx','run','held-continuation-probe:'+target,'--skip-nx-cache'],env=env)
 if r.returncode:sys.exit(r.returncode)
 # run-gates records failures without failing orchestration; stop this sequence on first red.
 if (p/(name+'.exit')).read_text().strip()!='0':sys.exit(1)
