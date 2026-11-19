import os,sys,json,subprocess,time
from pathlib import Path
p=Path(__file__).resolve().parent
name,copy,*argv=sys.argv[1:];d=p/'runs'/name;d.mkdir()
e=os.environ.copy();e.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+e['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false');e.pop('ST_PREPARED_REVIEW_OUTPUT',None)
(d/'COMMAND.json').write_text(json.dumps(dict(cwd=str(p/copy),argv=argv,env={k:e[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI']}),indent=2))
t=time.monotonic()
with (d/'first.log').open('w') as out:r=subprocess.run(argv,cwd=p/copy,env=e,stdout=out,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps(dict(exit=r.returncode,seconds=time.monotonic()-t)));print(name,r.returncode,flush=True)
