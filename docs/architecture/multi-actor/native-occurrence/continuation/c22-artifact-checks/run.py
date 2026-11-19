from pathlib import Path
import os,json,subprocess,sys,hashlib
root=Path('/private/tmp/st-parent-freshness-implementation-independent/c22-full-build-diagnostic/candidate'); dest=Path(__file__).parent/sys.argv[1];dest.mkdir(exist_ok=False)
manifest=json.loads(Path('/private/tmp/st-native-combined-c22/SNAPSHOT-C22.json').read_text())
def source():return {p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in manifest}
def artifacts():return {str(p.relative_to(root/'dist/packages')):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root/'dist/packages').rglob('*')) if p.is_file()}
assert source()==manifest;before=artifacts();(dest/'ARTIFACTS-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
env=os.environ.copy();env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'];env['NX_DAEMON']='false';env['NX_ISOLATE_PLUGINS']='false';env['NX_TUI']='false';env.pop('NODE_OPTIONS',None)
argv=['node',*sys.argv[2:]];(dest/'COMMAND.json').write_text(json.dumps({'cwd':str(root),'argv':argv,'node':'24.15.0','sourceManifestSha256':hashlib.sha256(Path('/private/tmp/st-native-combined-c22/SNAPSHOT-C22.json').read_bytes()).hexdigest()},indent=2)+'\n')
with (dest/'first.log').open('w') as log:r=subprocess.run(argv,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
after=artifacts();result={'exit':r.returncode,'sourceUnchanged':source()==manifest,'artifactsUnchanged':after==before};(dest/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));sys.exit(r.returncode)
