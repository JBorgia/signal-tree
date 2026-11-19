from pathlib import Path
import sys,json,hashlib,shutil,tempfile,os,subprocess,datetime
home=Path(__file__).resolve().parent
base=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/private/tmp/st-native-explicit-handoff-successor/candidate')
manifest=Path(sys.argv[2]) if len(sys.argv)>2 else base.parent/'SOURCE-SHA256.json'
source=json.loads(manifest.read_text())
for name,expected in source.items():
    assert hashlib.sha256((base/name).read_bytes()).hexdigest()==expected,name
out=Path(tempfile.mkdtemp(prefix='run-',dir=home));candidate=out/'candidate';observations=out/'observations';observations.mkdir()
shutil.copytree(base,candidate,symlinks=True,ignore=shutil.ignore_patterns('node_modules','.nx','.git','dist','coverage'))
(candidate/'node_modules').symlink_to((base/'node_modules').resolve(),target_is_directory=True)
fixture=home/'fixtures/independent-prepared-unit.spec.ts'
dest=candidate/'packages/kernel/src/lib/independent-prepared-unit.spec.ts'
assert not dest.exists();shutil.copy(fixture,dest)
versions={}
for name in ['typescript','vitest','nx']:
    versions[name]=json.loads((base/'node_modules'/name/'package.json').read_text())['version']
identity={'source':str(base),'manifest':str(manifest),'manifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'fixtureSha256':hashlib.sha256(fixture.read_bytes()).hexdigest(),'preregistrationSha256':hashlib.sha256((home/'PREREGISTERED.md').read_bytes()).hexdigest(),'versions':versions,'started':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(out/'IDENTITY.json').write_text(json.dumps(identity,indent=2));shutil.copy(fixture,out/'FIRST-FIXTURE.spec.ts');shutil.copy(manifest,out/'SOURCE-SHA256.json')
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',ST_PREPARED_REVIEW_OUTPUT=str(observations))
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','independent-prepared-unit.spec.ts']
with (out/'runtime.log').open('w') as log:
    result=subprocess.run(cmd,cwd=candidate,env=env,stdout=log,stderr=subprocess.STDOUT)
unchanged=all(hashlib.sha256((base/name).read_bytes()).hexdigest()==sha for name,sha in source.items())
(out/'RESULT.json').write_text(json.dumps({'command':cmd,'exit':result.returncode,'frozenSourceUnchanged':unchanged},indent=2))
print(json.dumps({'evidence':str(out),'exit':result.returncode,'frozenSourceUnchanged':unchanged}),flush=True)
sys.exit(result.returncode)
