from pathlib import Path
import os,sys,json,subprocess,hashlib
p=Path(__file__).parent;c=p/'candidate';name=sys.argv[1];argv=sys.argv[2:];d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False)
env=os.environ.copy();env.pop('ST_OBSERVATIONS',None);env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.update(PATH=str(p/'bin')+':/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'),ST_ROUTING_CHILD_LOG=str(d/'child.log'))
m=json.loads((p/'BASE-SNAPSHOT.json').read_text());snap=lambda:{n:hashlib.sha256((c/n).read_bytes()).hexdigest() for n in m if (c/n).exists()}
before=snap();(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','ST_ROUTING_CHILD_LOG']}},indent=2)+'\n')
with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT)
after=snap();assert before==after,'source drift (including unrestored mutant)'
(d/'SOURCE-AFTER.json').write_text(json.dumps({'unchanged':True,'trackedFiles':len(after)},indent=2)+'\n');(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode},indent=2)+'\n');print(name,r.returncode,flush=True);sys.exit(r.returncode)
