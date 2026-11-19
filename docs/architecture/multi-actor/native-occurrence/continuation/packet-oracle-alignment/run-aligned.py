from pathlib import Path
import os,json,subprocess
p=Path(__file__).parent;env=dict(os.environ,PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+os.environ['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
base=['corepack','pnpm','nx','test','kernel','--skip-nx-cache'];runs=[('aligned-first',base+['packet-index-adversarial.spec.ts','packet-index-review.spec.ts','--maxWorkers=1']),('focused',base+['independent-refusal-branches.spec.ts','point-admission-followup.spec.ts','admission-refusal.spec.ts','packet-admission-r1.spec.ts','packet-index-adversarial.spec.ts','packet-index-review.spec.ts','native-admission-handoff.spec.ts','native-invocation-handoff.spec.ts','structural-admission-controls.spec.ts','structural-admission-sequence.spec.ts','entity-publication-work-lifetime.spec.ts','publication-retirement-acceptance.spec.ts','--maxWorkers=1']),('point',base+['entity-granular-reactivity.spec.ts','--testNamePattern=a single-entity update does not rebuild','--maxWorkers=1']),('spec-types',['node','tools/check-spec-types.mjs'])];results=[]
for name,argv in runs:
 with (p/(name+'.log')).open('w') as out:r=subprocess.run(argv,cwd=p/'candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
 results.append({'name':name,'cwd':str(p/'candidate'),'argv':argv,'exit':r.returncode});(p/'COMMAND-RESULTS.json').write_text(json.dumps(results,indent=2)+'\n');print(name,r.returncode,flush=True)
 if name=='aligned-first' and r.returncode:break
