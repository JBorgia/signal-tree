from pathlib import Path
import os,sys,json,subprocess,hashlib
p=Path(__file__).parent;name=sys.argv[1];c=p/('baseline' if name.startswith('baseline-') else 'candidate');argv=sys.argv[2:]
d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False)
for f in c.rglob('effective-presence*.spec.ts'):
 out=d/'source'/f.relative_to(c);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(f.read_bytes())
for n in ['packages/kernel/src/lib/entity-signal.ts','packages/kernel/src/lib/internals/member-membership.ts']:
 f=c/n;out=d/'source'/n;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(f.read_bytes())
env=os.environ.copy();env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/('nx-cache-'+c.name)),NX_WORKSPACE_DATA_DIRECTORY=str(p/('nx-data-'+c.name)))
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY']},'ST_PREPARED_REVIEW_OUTPUT':'unset'},indent=2)+'\n')
with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode},indent=2)+'\n');print(name,r.returncode,flush=True)
sys.exit(r.returncode)
