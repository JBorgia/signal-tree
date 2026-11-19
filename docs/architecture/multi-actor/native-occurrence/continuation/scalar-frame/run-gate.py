import os,sys,subprocess,json,time,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1]; argv=sys.argv[2:]; dest=root/'runs'/name; dest.mkdir(parents=True,exist_ok=False)
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',ST_PREPARED_REVIEW_OUTPUT=str(dest/'observations'))
(dest/'observations').mkdir()
(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root/'candidate'),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','ST_PREPARED_REVIEW_OUTPUT']}},indent=2)+'\n')
def source_identity():
 base=root/'candidate'
 paths=set(json.loads((root/'PREDECESSOR-SNAPSHOT-A.json').read_text()))
 for directory,dirs,files in os.walk(base/'packages',followlinks=False):
  dirs[:]=[d for d in dirs if d not in {'node_modules','dist','.nx','coverage'}]
  paths.update(str((Path(directory)/f).relative_to(base)) for f in files if f.endswith(('.ts','.tsx','.json','.mjs','.js')))
 return {p:hashlib.sha256((base/p).read_bytes()).hexdigest() for p in sorted(paths) if (base/p).is_file()}
before=source_identity();(dest/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
t=time.monotonic()
with (dest/'first.log').open('w') as out:r=subprocess.run(argv,cwd=root/'candidate',env=env,stdout=out,stderr=subprocess.STDOUT)
(dest/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'elapsedSeconds':time.monotonic()-t},indent=2)+'\n')
after=source_identity();(dest/'SOURCE-AFTER.json').write_text(json.dumps({'unchanged':before==after,'changed':[p for p in before if before[p]!=after.get(p)]},indent=2)+'\n')
print(name,r.returncode)
sys.exit(r.returncode)
