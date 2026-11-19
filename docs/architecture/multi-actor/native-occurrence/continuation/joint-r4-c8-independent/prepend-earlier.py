from pathlib import Path
import json,hashlib,shutil,subprocess,os
b=Path('/private/tmp/st-r4-review-resumed');env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true')
for label,src in [('C0',Path('/private/tmp/st-native-combined-c')),('C7a',Path('/private/tmp/st-native-combined-c7a'))]:
 m=json.loads((src/('SNAPSHOT-'+label+'.json')).read_text());dst=b/(label.lower()+'-prepend-control')
 for f,h in m.items():
  p=src/'candidate'/f;assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==h,f
  q=dst/f;q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
 (dst/'node_modules').symlink_to(b/'candidate/node_modules',target_is_directory=True)
 cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','entity-membership-view-v16-controls.spec.ts','--testNamePattern=prependOne reports the row at the front once','--maxWorkers=1'];(b/(label+'-prepend-command.json')).write_text(json.dumps({'cwd':str(dst),'command':cmd,'verified_files':len(m)},indent=2))
 with (b/(label+'-prepend-first.log')).open('w') as out:r=subprocess.run(cmd,cwd=dst,env=env,stdout=out,stderr=subprocess.STDOUT)
 (b/(label+'-prepend-result.json')).write_text(json.dumps({'exit':r.returncode,'source_unchanged':all(hashlib.sha256((dst/f).read_bytes()).hexdigest()==h for f,h in m.items())}));print(label,r.returncode);print((b/(label+'-prepend-first.log')).read_text()[-1700:])
