import os,sys,subprocess,json,time,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1];argv=sys.argv[2:];dest=root/'runs'/name;dest.mkdir(parents=True,exist_ok=False)
for d in ['tmp','nx-cache','nx-data']:(root/d).mkdir(exist_ok=True)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(root/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(root/'nx-data'),TMPDIR=str(root/'tmp'),ST_POINT_ALLOCATION_OUTPUT=str(dest/'allocation.jsonl'),ST_PREPARED_REVIEW_OUTPUT=str(dest))
env.pop('NODE_PATH',None);env.pop('ST_PREPARED_REVIEW_OUTPUT',None)
if name.endswith('-no-output'):env.pop('ST_POINT_ALLOCATION_OUTPUT',None)
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env.get(k) for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_POINT_ALLOCATION_OUTPUT','ST_PREPARED_REVIEW_OUTPUT']}},indent=2))
def identity():
 base=root/'candidate';paths=set(json.loads((root/'BASE-MANIFEST.json').read_text()))
 return {p:hashlib.sha256((base/p).read_bytes()).hexdigest() for p in sorted(paths)}
before=identity();(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2));start=time.monotonic()
with (dest/'first.log').open('w') as f:r=subprocess.run(argv,cwd=root/'candidate',env=env,stdout=f,stderr=subprocess.STDOUT)
after=identity();result={'exit':r.returncode,'elapsedSeconds':time.monotonic()-start,'source_unchanged':before==after};(dest/'RESULT.json').write_text(json.dumps(result,indent=2));print(name,result,flush=True)
sys.exit(r.returncode)
