from pathlib import Path
import subprocess,os,json,hashlib
r=Path(__file__).parent;c=r/'candidate';env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
files='fixed-window-retirement.spec.ts entity-negative-publication-retirement.spec.ts publication-retirement-acceptance.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts entity-lifetime-ledger-null.spec.ts entity-selection-lifetime.spec.ts subject-reclamation-coordinator.spec.ts reclamation-eligibility.spec.ts publication-proof-retirement.spec.ts publication-terminal-obligation.spec.ts publication-native-provenance.spec.ts'.split()
commands=[('freeze-runtime',['corepack','pnpm','nx','test','kernel','--skip-nx-cache',*files,'--maxWorkers=1']),('freeze-spec-types',['node','tools/check-spec-types.mjs'])]
results=[]
for name,argv in commands:
 with (r/(name+'.log')).open('w') as log:result=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT)
 results.append(dict(name=name,cwd=str(c),argv=argv,exit=result.returncode));(r/'FINAL-COMMANDS.json').write_text(json.dumps(results,indent=2)+'\n')
 print(name,result.returncode,flush=True)
