from pathlib import Path
import os,json,hashlib,shutil,subprocess,concurrent.futures,threading,time
root=Path('/private/tmp/st-native-broad-differential')
sources={'predecessor':Path('/private/tmp/st-native-explicit-handoff-successor'),'successor':Path('/private/tmp/st-prepared-paired-successor')}
manifest={}; inventories={};identities={}
for label,home in sources.items():
 base=home/'candidate';mf=home/'SOURCE-SHA256.json';entries=json.loads(mf.read_text());assert all(hashlib.sha256((base/n).read_bytes()).hexdigest()==h for n,h in entries.items());manifest[label]=entries
 out=root/label;out.mkdir();copy=out/'candidate';shutil.copytree(base,copy,symlinks=True,ignore=shutil.ignore_patterns('node_modules','.nx','.git','dist','coverage'));(copy/'node_modules').symlink_to((base/'node_modules').resolve());shutil.copy(mf,out/'SOURCE-SHA256.json')
 inventories[label]={n:h for n,h in entries.items() if '.spec.' in n or '.test.' in n}
 identities[label]={'source':str(base),'manifestSha256':hashlib.sha256(mf.read_bytes()).hexdigest(),'dependencies':str((base/'node_modules').resolve()),'versions':{n:json.loads((base/'node_modules'/n/'package.json').read_text())['version'] for n in ['nx','vitest','typescript','@angular/core','react','vue','solid-js']}}
(root/'IDENTITIES.json').write_text(json.dumps(identities,indent=2));(root/'FIXTURE-INVENTORY.json').write_text(json.dumps(inventories,indent=2))
a=inventories['predecessor'];b=inventories['successor'];(root/'FIXTURE-DIFF.json').write_text(json.dumps({'unchanged':[n for n in a if b.get(n)==a[n]],'changed':[n for n in a if n in b and b[n]!=a[n]],'removed':[n for n in a if n not in b],'added':[n for n in b if n not in a]},indent=2))
# Historical diagnostics have fixed output paths. Serialize kernel runs, preserve
# existing bytes before execution, archive new outputs, and restore originals.
fixed=['owner-evidence-0.txt','owner-scope-leak.json','owner-scope-0.txt','flush-0.txt','flush-probe.txt','leaf-support-0.txt'];lock=threading.Lock()
def execute(label,project):
 out=root/label/project;out.mkdir();obs=out/'observations';obs.mkdir();prepared=obs/'prepared';prepared.mkdir();public=obs/'public';public.mkdir()
 env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',ST_OBSERVATIONS=str(obs/'native.jsonl'),ST_PREPARED_REVIEW_OUTPUT=str(prepared),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(public));env.pop('ST_PERF',None);env.pop('ST_PERF_OUTPUT_FILE',None);env.pop('SEMANTICS_REPORT',None)
 cmd=['corepack','pnpm','nx','test',project,'--skip-nx-cache','--reporter=json','--outputFile='+str(out/'vitest.json'),'--maxWorkers=2']
 (out/'COMMAND.json').write_text(json.dumps({'argv':cmd,'cwd':str(root/label/'candidate'),'node':'24.15.0','pnpm':'10.17.0','workerLimit':2,'purpose':'correctness only','outputEnvironment':{k:env[k] for k in ['ST_OBSERVATIONS','ST_PREPARED_REVIEW_OUTPUT','ST_PUBLIC_DIAGNOSTIC_OUTPUT']}},indent=2))
 if project=='kernel':lock.acquire()
 prior={}
 try:
  if project=='kernel':
   old=out/'prior-fixed-output';old.mkdir()
   for n in fixed:
    p=Path('/private/tmp')/n;prior[n]=p.read_bytes() if p.exists() else None
    if prior[n] is not None:(old/n).write_bytes(prior[n])
  with (out/'first.log').open('w') as log:result=subprocess.run(cmd,cwd=root/label/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT)
  (out/'RESULT.json').write_text(json.dumps({'exit':result.returncode,'jsonProduced':(out/'vitest.json').exists()},indent=2));print(label,project,result.returncode,flush=True)
 finally:
  if project=='kernel':
   new=out/'fixed-output';new.mkdir()
   for n in fixed:
    p=Path('/private/tmp')/n
    if p.exists():shutil.copy(p,new/n)
    if prior[n] is not None:p.write_bytes(prior[n])
    elif p.exists():p.unlink()
   lock.release()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 futures=[pool.submit(execute,label,p) for p in ['kernel','angular','react','vue','solid'] for label in sources]
 for f in concurrent.futures.as_completed(futures):f.result()
for label,home in sources.items():
 for base in [home/'candidate',root/label/'candidate']:assert all(hashlib.sha256((base/n).read_bytes()).hexdigest()==h for n,h in manifest[label].items()),str(base)
(root/'SOURCE-UNCHANGED.json').write_text(json.dumps({'originals':True,'copies':True}))
