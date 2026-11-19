import os,sys,subprocess,json,time,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1]; argv=sys.argv[2:]; dest=root/'runs'/name; dest.mkdir(parents=True,exist_ok=False)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(dest/'public-observations'))
(dest/'observations').mkdir();(dest/'public-observations').mkdir();(dest/'diagnostics').mkdir();env['ST_C21_DIAGNOSTIC_OUTPUT']=str(dest/'diagnostics')
for folder in ['tmp','nx-cache','nx-data']:(root/folder).mkdir(exist_ok=True)
env.update(NX_CACHE_DIRECTORY=str(root/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(root/'nx-data'),TMPDIR=str(root/'tmp'),NODE_OPTIONS='--require='+str(root/'diagnostic-redirect.cjs'))
env.pop('NODE_PATH',None)
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','ST_PREPARED_REVIEW_OUTPUT','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','NODE_OPTIONS']}},indent=2)+'\n')
def source_identity():
 paths=json.loads((root/'SNAPSHOT-C23.json').read_text())
 return {p:hashlib.sha256((root/'candidate'/p).read_bytes()).hexdigest() for p in paths}

before=source_identity();(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
t=time.monotonic()
with (dest/'first.log').open('w') as out:r=subprocess.run(argv,cwd=root/'candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
(dest/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n')
after=source_identity();(dest/'SOURCE-AFTER.json').write_text(json.dumps({'unchanged':before==after,'changed':[p for p in before if before[p]!=after.get(p)]},indent=2)+'\n')
print(name,r.returncode)
sys.exit(r.returncode)
