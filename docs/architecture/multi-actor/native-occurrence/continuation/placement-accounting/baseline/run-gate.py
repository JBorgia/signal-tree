import os,sys,subprocess,json,time
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1]; argv=sys.argv[2:]; dest=root/'runs'/name; dest.mkdir(parents=True,exist_ok=False)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'))
(dest/'observations').mkdir()
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','ST_PREPARED_REVIEW_OUTPUT']}},indent=2)+'\n')
t=time.monotonic()
with (dest/'first.log').open('w') as out:r=subprocess.run(argv,cwd=root/'candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
(dest/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n')
print(name,r.returncode)
sys.exit(r.returncode)
