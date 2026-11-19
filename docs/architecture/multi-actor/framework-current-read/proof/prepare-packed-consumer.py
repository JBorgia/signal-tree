from pathlib import Path
import subprocess,os,json,tarfile,shutil
r=Path.cwd();ev=r/'proof-evidence';c=ev/'consumer';dest=ev/'tarballs';dest.mkdir(exist_ok=True)
env=os.environ.copy();env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'];env['npm_config_cache']=str(ev/'npm-cache')
for name in ['kernel','angular','vue','solid']:
 result=subprocess.run(['npm','pack','--ignore-scripts','--json','--pack-destination',str(dest)],cwd=r/'dist/packages'/name,env=env,capture_output=True,text=True)
 (ev/f'pack-{name}.log').write_text(result.stdout+result.stderr);(ev/f'pack-{name}.exit').write_text(str(result.returncode)+'\n');result.check_returncode()
 archive=dest/json.loads(result.stdout)[0]['filename'];unpack=ev/'unpacked'/name;unpack.mkdir(parents=True,exist_ok=True)
 with tarfile.open(archive) as t:t.extractall(unpack,filter='data')
 target=c/'node_modules/@signal-tree'/name
 if target.is_symlink():target.unlink()
 shutil.move(str(unpack/'package'),target)
for resolution in ['bundler','node16']:
 p=c/f'tsconfig.{resolution}.json';config=json.loads(p.read_text());config['compilerOptions']['preserveSymlinks']=False;p.write_text(json.dumps(config,indent=2)+'\n')
p=c/'src/migration.ts';shutil.copy2(p,ev/'consumer-migration-first.ts');s=p.read_text()
for name in ['angular','vue','solid']:
 s=s.replace(f'../../../..//dist/packages/{name}/',f'../node_modules/@signal-tree/{name}/')
p.write_text(s)
