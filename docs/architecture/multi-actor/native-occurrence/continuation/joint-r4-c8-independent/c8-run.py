import os,subprocess,json,sys
from pathlib import Path
b=Path('/private/tmp/st-r4-review-resumed');name=sys.argv[1];cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache',*sys.argv[2:],'--maxWorkers=1'];env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',CI='true',ST_PREPARED_REVIEW_OUTPUT=str(b));(b/(name+'-command.json')).write_text(json.dumps({'cwd':str(b/'c8-candidate'),'command':cmd},indent=2))
with (b/(name+'-first.log')).open('w') as out:r=subprocess.run(cmd,cwd=b/'c8-candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
(b/(name+'-exit.json')).write_text(json.dumps({'exit':r.returncode}));print((b/(name+'-first.log')).read_text()[-3500:])
