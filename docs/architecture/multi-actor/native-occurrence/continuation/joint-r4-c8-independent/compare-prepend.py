from pathlib import Path
import json,hashlib,shutil,subprocess,os
b=Path('/private/tmp/st-r4-review-resumed');m=json.loads((b/'PREDECESSOR-SHA256.json').read_text());src=Path('/private/tmp/st-joint-phase-successor-r3/candidate');dst=b/'r3-control';verified=0
for f,h in m.items():
 p=src/f;assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==h,f
 q=dst/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q);verified+=1
(dst/'node_modules').symlink_to(b/'candidate/node_modules',target_is_directory=True)
(b/'r3-control-identity.json').write_text(json.dumps({'manifest_sha256':hashlib.sha256((b/'PREDECESSOR-SHA256.json').read_bytes()).hexdigest(),'verified_files':verified},indent=2))
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true')
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','entity-membership-view-v16-controls.spec.ts','--maxWorkers=1'];(b/'r3-command.json').write_text(json.dumps({'cwd':str(dst),'command':cmd},indent=2))
with (b/'r3-first.log').open('w') as out:r=subprocess.run(cmd,cwd=dst,env=env,stdout=out,stderr=subprocess.STDOUT)
(b/'r3-exit.json').write_text(json.dumps({'exit':r.returncode}));print('R3 exit',r.returncode);print((b/'r3-first.log').read_text()[-2500:])
