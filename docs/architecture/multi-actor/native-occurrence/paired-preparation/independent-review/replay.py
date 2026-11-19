from pathlib import Path
import json,hashlib,shutil,tempfile,os,subprocess
h=Path(__file__).resolve().parent;b=Path('/private/tmp/st-prepared-paired-successor/candidate');m=b.parent/'SOURCE-SHA256.json';s=json.loads(m.read_text())
assert hashlib.sha256(m.read_bytes()).hexdigest()=='c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db'
assert all(hashlib.sha256((b/k).read_bytes()).hexdigest()==v for k,v in s.items())
o=Path(tempfile.mkdtemp(prefix='run-',dir=h));c=o/'candidate';obs=o/'observations';obs.mkdir()
shutil.copytree(b,c,symlinks=True,ignore=shutil.ignore_patterns('node_modules','.git','.nx','dist','coverage'));(c/'node_modules').symlink_to((b/'node_modules').resolve(),target_is_directory=True)
fixtures={}
for n in ['independent-prepared-unit.spec.ts','independent-prepared-boundary.spec.ts']:
 p=Path('/private/tmp/st-prepared-unit-review/fixtures')/n;dest=c/'packages/kernel/src/lib'/n
 assert p.read_bytes()==dest.read_bytes(),n
 shutil.copy2(p,o/n);fixtures[n]=hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copy2(m,o/'SOURCE-SHA256.json')
(o/'IDENTITY.json').write_text(json.dumps({'source':str(b),'fixtures':fixtures,'manifestSha256':hashlib.sha256(m.read_bytes()).hexdigest()},indent=2))
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',ST_PREPARED_REVIEW_OUTPUT=str(obs))
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache',*fixtures]
with (o/'runtime.log').open('w') as f:r=subprocess.run(cmd,cwd=c,env=env,stdout=f,stderr=subprocess.STDOUT)
result={'command':cmd,'exit':r.returncode,'sourceUnchanged':all(hashlib.sha256((b/k).read_bytes()).hexdigest()==v for k,v in s.items())}
(o/'RESULT.json').write_text(json.dumps(result,indent=2));print(json.dumps({'run':str(o),**result}));
