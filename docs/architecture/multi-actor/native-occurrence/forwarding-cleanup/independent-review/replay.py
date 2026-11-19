from pathlib import Path
import json,hashlib,shutil,subprocess,os,difflib
h=Path(__file__).resolve().parent;b=Path('/private/tmp/st-selected-forwarding-cleanup-successor/candidate');m=b.parent/'SOURCE-SHA256.json';s=json.loads(m.read_text());expected='d3b6da2906ae9cef72e5623b35eb6de3dee73d64b12f5c9bd408352aa627e73b'
assert hashlib.sha256(m.read_bytes()).hexdigest()==expected
assert all(hashlib.sha256((b/k).read_bytes()).hexdigest()==v for k,v in s.items())
p=Path('/private/tmp/st-prepared-paired-successor/candidate');old=json.loads((p.parent/'SOURCE-SHA256.json').read_text());assert all(hashlib.sha256((p/k).read_bytes()).hexdigest()==v for k,v in old.items())
changed=[k for k in old if s.get(k)!=old[k]]
assert set(changed)=={'packages/kernel/src/lib/internals/selected-write-operation.ts','packages/kernel/src/lib/internals/location-runtime.ts','packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts'},changed
patch=''
for k in changed:patch+=''.join(difflib.unified_diff((p/k).read_text().splitlines(True),(b/k).read_text().splitlines(True),fromfile='c47b/'+k,tofile='cleanup/'+k))
(h/'actual-runtime.diff').write_text(patch);shutil.copy2(b.parent/'source.patch',h/'author-source.patch');shutil.copy2(m,h/'SOURCE-SHA256.json')
c=h/'candidate';shutil.copytree(b,c,symlinks=True,ignore=shutil.ignore_patterns('node_modules','.git','.nx','dist','coverage'));(c/'node_modules').symlink_to((b/'node_modules').resolve(),target_is_directory=True)
assert (c/'packages/kernel/src/lib/held-continuation-probe.spec.ts').read_bytes()==Path('/private/tmp/st-held-continuation-review/probe.spec.ts').read_bytes()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
runs=[]
def run(name,cmd,extra=None):
 e=env.copy();e.update(extra or {})
 with (h/(name+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=c,env=e,stdout=f,stderr=subprocess.STDOUT)
 result={'name':name,'command':cmd,'cwd':str(c),'extraEnv':extra,'exit':r.returncode};runs.append(result);(h/'RUNS.json').write_text(json.dumps(runs,indent=2));print(json.dumps(result),flush=True);return r.returncode
run('nine-controls',['corepack','pnpm','nx','test','kernel','--skip-nx-cache','selected-forwarding-cleanup.spec.ts'])
for scenario in ['success','caught','skip']:
 for arm in ['drop-proceed','hold-proceed']:
  name=scenario+'-'+arm
  target='retention' if scenario=='success' else 'extended'
  run(name,['corepack','pnpm','nx','run','held-continuation-probe:'+target,'--skip-nx-cache'],{'NODE_OPTIONS':'--expose-gc','ST_GC_ARM':arm,'ST_GC_SCENARIO':scenario,'ST_GC_OUTPUT':str(h/(name+'.json'))})
verified=all(hashlib.sha256((b/k).read_bytes()).hexdigest()==v for k,v in s.items());copyverified=all(hashlib.sha256((c/k).read_bytes()).hexdigest()==v for k,v in s.items())
(h/'IDENTITY.json').write_text(json.dumps({'manifestSha256':expected,'entries':len(s),'originalUnchanged':verified,'copyUnchanged':copyverified,'predecessorRuntimeChanges':changed,'successProbeUnchanged':True,'versions':{n:json.loads((c/'node_modules'/n/'package.json').read_text())['version'] for n in ['nx','vitest','typescript']}},indent=2));print('verification complete',flush=True)
