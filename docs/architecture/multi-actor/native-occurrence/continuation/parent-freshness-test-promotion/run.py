from pathlib import Path
import os,sys,json,subprocess,hashlib
p=Path(__file__).parent;c=p/'candidate';name=sys.argv[1];argv=sys.argv[2:];d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False)
env=os.environ.copy();env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'))
assert 'ST_PREPARED_REVIEW_OUTPUT' not in env
manifest=json.loads((p/'BASE-SOURCE.json').read_text());inventory=json.loads((p/'INVENTORY.json').read_text());excluded=set(inventory['researchOnly'])
def source():return {n:hashlib.sha256((c/n).read_bytes()).hexdigest() for n in manifest if n not in excluded}
before=source();(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'ST_PREPARED_REVIEW_OUTPUT':'explicitly removed from subprocess environment','env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY']}},indent=2)+'\n')
with (d/'first.log').open('w') as out:r=subprocess.run(argv,cwd=c,env=env,stdout=out,stderr=subprocess.STDOUT)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'sourcesUnchangedDuringRun':before==source()},indent=2)+'\n');print(name,r.returncode,flush=True)
