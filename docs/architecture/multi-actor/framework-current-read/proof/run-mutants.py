from pathlib import Path
import subprocess,os,signal,json,hashlib,difflib,time
r=Path.cwd();d=r/'proof-evidence/mutations';d.mkdir(exist_ok=True)
a='packages/angular/src/lib/observation-adapter.ts';e='packages/kernel/src/lib/entity-signal.ts';n='packages/kernel/src/lib/internals/native-location-realization.ts'
base={p:(r/p).read_text() for p in [a,e,n]};hashes={p:hashlib.sha256(s.encode()).hexdigest() for p,s in base.items()}
for p,s in base.items():
 q=d/'base'/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_text(s)
mutants=[]
s=base[a].replace('createCurrentReadonlyCell: currentReadonly,','createCurrentReadonlyCell: <T>(read: () => T) => computed(read),')
mutants.append(('cached-current',a,s,'selected-callback-facade','realizes fresh tap reads'))
s=base[a].replace('  return new Proxy(source, {','  return new Proxy(source, {\n    get: (_target, key) => Reflect.get(computed(readCurrent), key),',1)
mutants.append(('per-read-metadata',a,s,'selected-callback-facade','retains coherent native metadata'))
s=base[n].replace('      invalidationGroupDepth += 1;','      // MUTANT: do not hold publication.').replace('          invalidationGroupDepth -= 1;','          // MUTANT: no held group to release.')
mutants.append(('premature-publication',n,s,'selected-callback-facade','keeps ordinary selected observation granular'))
s=base[a];start=s.index('function currentReadonly');end=s.index('/** Angular dependency',start);s=s[:start]+s[start:end].replace('readCurrent()','untracked(readCurrent)')+s[end:]
mutants.append(('dropped-tracking',a,s,'current-read-capability','source-linked producer preserves held'))
s=base[e].replace('    taps.depth++;','    const priorSelection = activeIdValue;\n    taps.depth++;',1).replace('      taps.depth--;','      replaceLocation(activeIdSignal, priorSelection);\n      taps.depth--;',1)
mutants.append(('overwritten-callback-writes',e,s,'selected-callback-facade','realizes fresh tap reads'))
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
results=[]
try:
 for name,path,changed,file,pattern in mutants:
  assert changed!=base[path],name
  (d/f'{name}.patch').write_text(''.join(difflib.unified_diff(base[path].splitlines(True),changed.splitlines(True),fromfile='a/'+path,tofile='b/'+path)))
  command=['corepack','pnpm','nx','test','angular','--skip-nx-cache','--',file,'-t',pattern,'--maxWorkers=2']
  (r/path).write_text(changed)
  try:
   with (d/f'{name}.log').open('w') as log:
    process=subprocess.Popen(command,cwd=r,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    try:code=process.wait(timeout=90)
    except subprocess.TimeoutExpired:
     os.killpg(process.pid,signal.SIGTERM);process.wait(timeout=10);code=124
  finally:(r/path).write_text(base[path])
  assert all(hashlib.sha256((r/p).read_bytes()).hexdigest()==h for p,h in hashes.items())
  (d/f'{name}.exit').write_text(str(code)+'\n')
  result={'name':name,'changedFile':path,'baseSha256':hashes[path],'mutantSha256':hashlib.sha256(changed.encode()).hexdigest(),'command':command,'exit':code,'restored':True}
  results.append(result);print(json.dumps(result),flush=True)
finally:
 for p,s in base.items():(r/p).write_text(s)
 (d/'results.json').write_text(json.dumps(results,indent=2)+'\n')
assert len(results)==5 and all(x['exit']==1 for x in results), 'Inspect unqualified mutant results'
