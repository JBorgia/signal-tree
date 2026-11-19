from pathlib import Path
import os,json,hashlib,shutil,subprocess,time
p=Path(__file__).parent;s=Path('/private/tmp/st-native-combined-c12');expected='d96cb84faeec4f098b4bba00deb9b82b108a33469b965978e4d248fa354b1df2';h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert h(s/'SNAPSHOT-C12.json')==expected
m=json.loads((s/'SNAPSHOT-C12.json').read_text());(p/'SNAPSHOT-C12.json').write_bytes((s/'SNAPSHOT-C12.json').read_bytes())
for n,d in m.items():
 f=s/'candidate'/n;assert h(f)==d,n
 out=p/'candidate'/n;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,out)
assert all(h(p/'candidate'/n)==d for n,d in m.items())
old=Path('/private/tmp/st-dormant-publication-feasibility/candidate/node_modules');deps=p/'candidate/node_modules';deps.mkdir()
for f in old.iterdir():
 if f.name in {'.bin','.cache','.vite'}:continue
 (deps/f.name).symlink_to(f.resolve())
shutil.copytree(old/'.bin',deps/'.bin',symlinks=False)
for f in (deps/'.bin').iterdir():
 try:t=f.read_text()
 except UnicodeError:continue
 f.write_text(t.replace(str(old),str(deps)))
assert h(p/'candidate/pnpm-lock.yaml')==h(old.parent/'pnpm-lock.yaml')
(p/'VERIFIED-INPUT.json').write_text(json.dumps({'manifest_sha256':expected,'all_files_verified':len(m),'dependency_source':str(old),'lock_sha256':h(p/'candidate/pnpm-lock.yaml'),'dependency_use':'read-only package links; private command shims and caches'},indent=2)+'\n')
env=os.environ.copy();env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.pop('ST_POINT_ALLOCATION_OUTPUT',None);env.pop('NODE_PATH',None)
for n in ['nx-cache','nx-data','tmp','npm-cache']:(p/n).mkdir()
env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'),TMPDIR=str(p/'tmp'),npm_config_cache=str(p/'npm-cache'))
versions={}
for name,argv in [('node',['node','--version']),('pnpm',['corepack','pnpm','--version'])]:versions[name]=subprocess.check_output(argv,cwd=p/'candidate',env=env,text=True).strip()
assert versions=={'node':'v24.15.0','pnpm':'10.17.0'},versions
(p/'ENVIRONMENT.json').write_text(json.dumps({'versions':versions,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','npm_config_cache']},'ST_PREPARED_REVIEW_OUTPUT':'unset'},indent=2)+'\n')
print('verified all',len(m),'files and pinned versions',versions,flush=True)
jobs=[('source-types',['corepack','pnpm','exec','tsc','--noEmit','--pretty','false','-p','tsconfig.typecheck-all.json']),('spec-types',['node','tools/check-spec-types.mjs'])]+[(n,['corepack','pnpm','nx','test',n,'--skip-nx-cache','--maxWorkers=1']) for n in ['angular','react','vue','solid']]
results={}
for name,argv in jobs:
 d=p/'runs'/name;d.mkdir(parents=True)
 (p/'STATUS.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
 before={n:h(p/'candidate'/n) for n in m};assert before==m
 (d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(p/'candidate'),'argv':argv,'env_file':str(p/'ENVIRONMENT.json'),'ST_PREPARED_REVIEW_OUTPUT':'unset'},indent=2)+'\n')
 start=time.monotonic()
 with (d/'first.log').open('w') as f:r=subprocess.run(argv,cwd=p/'candidate',env=env,stdout=f,stderr=subprocess.STDOUT)
 changed=[n for n,v in m.items() if h(p/'candidate'/n)!=v]
 result={'exit':r.returncode,'elapsedSeconds':time.monotonic()-start,'source_unchanged':not changed,'changed':changed};results[name]=result
 (d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(name,result,flush=True)
 assert not changed,changed
assert h(s/'SNAPSHOT-C12.json')==expected
assert all(h(s/'candidate'/n)==v for n,v in m.items())
(p/'FINAL-VERIFICATION.json').write_text(json.dumps({'manifest_sha256':expected,'original_and_copy_files_verified':len(m),'results':results},indent=2)+'\n')
(p/'STATUS.json').write_text(json.dumps({'running':None,'completed':results},indent=2)+'\n')
