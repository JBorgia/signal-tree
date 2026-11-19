from pathlib import Path
import os,subprocess,json
p=Path(__file__).resolve().parent
e={**os.environ,'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+os.environ['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_TUI':'false'}
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','membership-reversal-delivery.spec.ts','--testNamePattern=left clear \\+ right clear','--maxWorkers=1']
r={}
for arm in ['c0','candidate']:
 with (p/(arm+'-minimal-membership.log')).open('w') as f:x=subprocess.run(cmd,cwd=p/arm,env=e,stdout=f,stderr=subprocess.STDOUT)
 r[arm]={'exit':x.returncode,'command':cmd};print(arm,x.returncode,flush=True)
(p/'MINIMAL-TRIAGE.json').write_text(json.dumps(r,indent=2))
