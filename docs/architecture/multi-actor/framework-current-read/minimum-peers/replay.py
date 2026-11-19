from pathlib import Path
import json,hashlib,tarfile,subprocess,datetime
base=Path(__file__).resolve().parent
freeze=Path('/private/tmp/st-current-read-capability-proof/proof-evidence/ARTIFACT-FREEZE.json')
assert hashlib.sha256(freeze.read_bytes()).hexdigest()=='fee0a010942dd933b7cb421bf3f353131e957a903eb3bf2205c35f4486f3f4b8'
m=json.loads(freeze.read_text());source=Path(m['sourceIdentity'])
assert hashlib.sha256(source.read_bytes()).hexdigest()==m['sourceIdentitySha256']
for rel,h in json.loads(source.read_text())['files'].items():assert hashlib.sha256((source.parent.parent/rel).read_bytes()).hexdigest()==h,rel
for rel,h in json.loads((base/'CONTROL-IDENTITY.json').read_text()).items():assert hashlib.sha256((base/rel).read_bytes()).hexdigest()==h,rel
out=base/('replay-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'));out.mkdir()
results={}
node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node'
for name,facade in [('angular20','angular'),('angular21','angular'),('vue350','vue')]:
 d=base/name
 for pkg in ['kernel',facade]:
  info=m['tarballs'][pkg];p=Path(info['path']);assert hashlib.sha256(p.read_bytes()).hexdigest()==info['sha256']
  with tarfile.open(p) as tf:
   for member in tf.getmembers():
    if member.isfile():
     installed=d/'node_modules'/'@signal-tree'/pkg/Path(member.name).relative_to('package')
     assert installed.read_bytes()==tf.extractfile(member).read(),str(installed)
 jobs=[('types-bundler',[node,'node_modules/typescript/bin/tsc','-p','tsconfig.bundler.json']),('types-node16',[node,'node_modules/typescript/bin/tsc','-p','tsconfig.node16.json']),('runtime',[node,'--test','public-controls.mjs','independent-controls.mjs'])]
 if facade=='angular':jobs.append(('aot',[node,'node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js','-p','tsconfig.aot.json']))
 results[name]={}
 for gate,cmd in jobs:
  with (out/f'{name}-{gate}.log').open('w') as log:r=subprocess.run(cmd,cwd=d,stdout=log,stderr=subprocess.STDOUT)
  results[name][gate]={'command':cmd,'exit':r.returncode};print(name,gate,r.returncode,flush=True)
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
print('Installed tarball bytes/source/control identities verified. Logs:',out)
raise SystemExit(int(any(g['exit'] for row in results.values() for g in row.values())))
