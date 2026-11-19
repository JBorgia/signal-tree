from pathlib import Path
import os,json,hashlib,subprocess,datetime
p=Path(__file__).parent;base=Path('/private/tmp/st-native-combined-c11');c=base/'candidate';raw=(base/'SNAPSHOT-COUNTERPARTS.json').read_bytes();m=json.loads(raw)
sha=lambda b:hashlib.sha256(b).hexdigest()
def verify():
 bad=[]
 for n,h in m.items():
  f=c/n
  if not f.is_file() or sha(f.read_bytes())!=h:bad.append(n)
 return bad
assert not verify(),'C11 manifest mismatch'
c10=json.loads(Path('/private/tmp/st-native-combined-c10-promoted/SNAPSHOT.json').read_text())
changes=[n for n in m if c10.get(n)!=m[n]]
expected={'packages/kernel/src/lib/whole-value-new-keys.spec.ts','packages/react/src/parent-freshness-counterparts.spec.tsx','packages/vue/src/lib/parent-freshness-counterparts.spec.ts','packages/solid/src/lib/parent-freshness-counterparts.spec.ts'}
assert set(changes)==expected,changes
assert all(n in m for n in c10)
(p/'FROM-C10.json').write_text(json.dumps({'changedOrAdded':changes,'removed':[],'allOtherManifestEntriesUnchanged':True,'runtimeIdenticalToC10':True,'scope':'C10 first failures preserved; targeted counterpart composition only'},indent=2)+'\n')
root=Path('/Users/jonathanborgia/code/signaltree');assert (root/'pnpm-lock.yaml').read_bytes()==(c/'pnpm-lock.yaml').read_bytes(),'root lock differs'
assert (c/'.nvmrc').read_text().strip()=='24.15.0'
assert json.loads((c/'package.json').read_text())['packageManager']=='pnpm@10.17.0'
env=os.environ.copy();env.pop('ST_PREPARED_REVIEW_OUTPUT',None);env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'))
versions={}
for name,cmd in [('node',['node','--version']),('pnpm',['corepack','pnpm','--version'])]:
 r=subprocess.run(cmd,cwd=c,env=env,capture_output=True,text=True);assert r.returncode==0,(cmd,r.stderr);versions[name]=r.stdout.strip()
assert versions=={'node':'v24.15.0','pnpm':'10.17.0'},versions
(p/'INPUT-SNAPSHOT.json').write_bytes(raw)
(p/'BASE-VERIFIED.json').write_text(json.dumps({'manifest':str(base/'SNAPSHOT-COUNTERPARTS.json'),'manifestSha256':sha(raw),'files':len(m),'mismatches':[],'cwd':str(c),'dependencyRealPath':str((c/'node_modules').resolve()),'rootLockMatches':True,'lockSha256':sha((c/'pnpm-lock.yaml').read_bytes()),'versions':versions,'ST_PREPARED_REVIEW_OUTPUT':'unset','kernelAndBuilds':'not run'},indent=2)+'\n')
commands=[('source-types',['corepack','pnpm','exec','tsc','--noEmit','--pretty','false','-p','tsconfig.typecheck-all.json']),('spec-types',['node','tools/check-spec-types.mjs'])]+[(f,['corepack','pnpm','nx','test',f,'--skip-nx-cache','parent-freshness-counterparts.spec.'+('tsx' if f=='react' else 'ts'),'--maxWorkers=1']) for f in ['react','vue','solid']]
(p/'COMMANDS.json').write_text(json.dumps(commands,indent=2)+'\n');results=[]
for name,argv in commands:
 assert not verify(),'input source drift before '+name
 d=p/'runs'/name;d.mkdir(parents=True,exist_ok=False)
 (p/'STATUS.json').write_text(json.dumps({'running':name,'completed':results},indent=2)+'\n')
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':{k:env[k] for k in ['PATH','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY']},'ST_PREPARED_REVIEW_OUTPUT':'explicitly removed'},indent=2)+'\n')
 with (d/'first.log').open('w') as log:r=subprocess.run(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT)
 bad=verify();result={'name':name,'exit':r.returncode,'manifestMismatchesAfter':bad}
 (d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');results.append(result)
 print(name,r.returncode,flush=True)
 assert not bad,'source changed during '+name
(p/'STATUS.json').write_text(json.dumps({'running':None,'completed':results},indent=2)+'\n')
(p/'FINAL-VERIFICATION.json').write_text(json.dumps({'manifestSha256':sha(raw),'files':len(m),'mismatches':verify(),'executedSequentially':True,'results':results},indent=2)+'\n')
