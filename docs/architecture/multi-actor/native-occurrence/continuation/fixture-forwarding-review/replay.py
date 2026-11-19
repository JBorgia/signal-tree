from pathlib import Path
import json,hashlib,shutil,os,sys
r=Path(__file__).resolve().parent;s=Path('/private/tmp/st-c21-fixture-corrections');h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((s/'SNAPSHOT-CANDIDATE.json').read_text());c=r/'candidate';c.mkdir(exist_ok=False)
for p,v in m.items():
 src=s/'candidate'/p;assert h(src)==v,p
 dst=c/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst);assert h(dst)==v,p
os.symlink('/private/tmp/st-parent-freshness-implementation-independent/candidate/node_modules',c/'node_modules')
for f in ['FREEZE.json','SNAPSHOT-CANDIDATE.json','BASE-MANIFEST.json','injection-forwarding.patch','REVIEW.md']:shutil.copyfile(s/f,r/('AUTHOR-'+f))
(r/'SOURCE-BEFORE.json').write_text(json.dumps(m,indent=2)+'\n')
rec=Path('/private/tmp/st-parent-freshness-implementation-independent/c21-recorder-validation');sys.path.insert(0,str(rec));from watchdog_v2 import run
out=r/'run';env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_RECORDER_OUTPUT=str(out))
for k,v in [('NX_CACHE_DIRECTORY','nx-cache'),('NX_WORKSPACE_DATA_DIRECTORY','nx-data'),('TMPDIR','tmp')]:
 (r/v).mkdir(exist_ok=True);env[k]=str(r/v)
env.pop('NODE_PATH',None);env.pop('NODE_OPTIONS',None)
pattern='attempts later live lifetime invalidation|attempts mixed installed invalidation|restores ordinary membership with a foreign live-row field before the next transaction captures'
argv=['corepack','pnpm','nx','test','kernel','heterogeneous-independent-invalidation.spec.ts','heterogeneous-invalidation-containment.spec.ts','heterogeneous-live-subject.spec.ts','--testNamePattern='+pattern,'--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(rec/'recorder-reporter-v2.mjs')]
x=run(argv,c,env,out);after={p:h(c/p) for p in m};x['sourceUnchanged']=after==m;x['threePassed']='3 passed | 3 skipped (6)' in (out/'first.log').read_text();(r/'VERIFICATION.json').write_text(json.dumps(x,indent=2)+'\n');assert x['exit']==0 and x['sourceUnchanged'] and x['threePassed'] and x['caseStartsObserved']==3,x
