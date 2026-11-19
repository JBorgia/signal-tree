import pathlib,hashlib,json,shutil,os,subprocess,time
out=pathlib.Path(__file__).resolve().parent
source=pathlib.Path('/private/tmp/st-structural-admission-successor/candidate'); pred=source
manifest=json.loads(pathlib.Path('/private/tmp/st-structural-admission-successor/SOURCE-SHA256.json').read_text())
copy=out/'candidate';copy.mkdir(exist_ok=False)
hashes={};delta=[]
for p,h in manifest.items():
 src=source/p; b=src.read_bytes();hashes[p]=hashlib.sha256(b).hexdigest()
 if hashes[p]!=h:delta.append(p)
 dst=copy/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
(copy/'node_modules').symlink_to((source/'node_modules').resolve(),target_is_directory=True)
(out/'SOURCE-SHA256.json').write_text(json.dumps(hashes,indent=2)+'\n')
(out/'DELTA.json').write_text(json.dumps(delta,indent=2)+'\n')
assert delta==[],delta
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
cmd=['corepack','pnpm','nx','test','kernel','--skip-nx-cache','structural-admission-controls.spec.ts','structural-admission-sequence.spec.ts','--reporter=json','--outputFile='+str(out/'vitest.json'),'--maxWorkers=2']
(out/'COMMAND.json').write_text(json.dumps({'cwd':str(copy),'argv':cmd,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI']}},indent=2)+'\n')
start=time.monotonic()
with (out/'first.log').open('w') as log:r=subprocess.run(cmd,cwd=copy,env=env,stdout=log,stderr=subprocess.STDOUT)
changed=[p for p,h in hashes.items() if hashlib.sha256((copy/p).read_bytes()).hexdigest()!=h or hashlib.sha256((source/p).read_bytes()).hexdigest()!=h]
(out/'RESULT.json').write_text(json.dumps({'exit':r.returncode,'seconds':time.monotonic()-start,'sourceChanges':changed},indent=2)+'\n')
print('exit',r.returncode,'sourceChanges',changed)
