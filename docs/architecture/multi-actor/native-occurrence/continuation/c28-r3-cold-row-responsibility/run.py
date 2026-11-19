from pathlib import Path
import subprocess,os,json,sys,hashlib,shutil
w=Path(__file__).resolve().parent;variant=sys.argv[1];name=sys.argv[2];c=w/variant;d=w/'runs'/name;d.mkdir(parents=True,exist_ok=False);(d/'tmp').mkdir();env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],ST_READER_CANDIDATE='1' if variant=='candidate' else '0',NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(d/'cache'),NX_WORKSPACE_DATA_DIRECTORY=str(d/'data'),TMPDIR=str(d/'tmp'),ST_COLD_OUTPUT=str(d/'observations.jsonl'),ST_SNAPSHOT_OUTPUT=str(d/'observations.jsonl'))
argv=sys.argv[3:];(d/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(c),'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k=='TMPDIR'}},indent=2)+'\n')
for f in (c/'packages/kernel/src/lib').glob('*preparation-reader*.spec.ts'):shutil.copy2(f,d/f.name)
f=c/'packages/kernel/src/lib/cold-row-responsibility.spec.ts'
if f.exists():shutil.copy2(f,d/f.name)
with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=240)
(d/'EXIT').write_text(str(r.returncode)+'\n');print(name,r.returncode,flush=True)
