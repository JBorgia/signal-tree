from pathlib import Path
import json,os,subprocess,sys
p=Path(__file__).parent;phase=sys.argv[1];env=dict(os.environ,PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+os.environ['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_SINGLETON_ALLOCATION_OUTPUT=str(p/(phase+'-allocation.jsonl')))
base=['corepack','pnpm','nx','test','kernel','--skip-nx-cache'];tests=['singleton-row-reuse.spec.ts','singleton-row-allocation.spec.ts'];
if phase=='successor':tests+=['packet-index-adversarial.spec.ts','packet-index-review.spec.ts','packet-admission-r1.spec.ts','admission-refusal.spec.ts','independent-refusal-branches.spec.ts','point-admission-followup.spec.ts','native-admission-handoff.spec.ts','native-invocation-handoff.spec.ts','entity-publication-work-lifetime.spec.ts','publication-retirement-acceptance.spec.ts']
runs=[('controls',base+tests+['--maxWorkers=1']),('point',base+['entity-granular-reactivity.spec.ts','--testNamePattern=a single-entity update does not rebuild','--maxWorkers=1'])]
if phase=='successor':runs += [('source-types',['corepack','pnpm','run','typecheck:source']),('spec-types',['node','tools/check-spec-types.mjs'])]
results=[]
for name,argv in runs:
 with (p/(phase+'-'+name+'.log')).open('w') as out:r=subprocess.run(argv,cwd=p/'candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
 results.append({'phase':phase,'name':name,'cwd':str(p/'candidate'),'argv':argv,'exit':r.returncode});(p/(phase+'-commands.json')).write_text(json.dumps(results,indent=2)+'\n');print(name,r.returncode,flush=True)
 if name=='controls' and r.returncode:break
