from pathlib import Path
import os,json,hashlib,shutil,subprocess,time,signal
r=Path(__file__).resolve().parent;b=Path('/private/tmp/st-c28-r1-current-capture');c=r/'candidate';h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=b/'MANIFEST.json';expected='9805ab2fae49202a334ef506c71a3583ff0f8dfebec51e8b27d992b23971653b';assert h(m)==expected
manifest=json.loads(m.read_text());shutil.copyfile(m,r/'BASE-MANIFEST.json')
for rel,digest in manifest.items():
 src=b/'candidate'/rel;assert h(src)==digest,rel
 dest=c/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);assert h(dest)==digest
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copyfile('/private/tmp/st-c27-remaining-failure-replay/diagnostic-redirect.cjs',r/'diagnostic-redirect.cjs')
prior=Path('/private/tmp/st-c27-public-composition/runs');framework=Path('/private/tmp/st-c26-finite-followup/runs')
jobs=[('kernel54',prior/'focused-first/COMMAND.json'),('kernel59',Path('/private/tmp/st-c27-remaining-failure-replay/runs/composition/COMMAND.json'))]+[(x,prior/x/'COMMAND.json') for x in ['source-types','public-types','spec-types']]+[(x+'-focused',framework/(x+'-focused')/'COMMAND.json') for x in ['angular','react','vue','solid']]
identities=[]
for name,p in jobs:
 command=json.loads(p.read_text());argv=command['argv']
 if argv[2]=='nx':
  project=argv[4];orig=Path(command['cwd'])
  for pattern in argv[5:]:
   if pattern.startswith('--'):continue
   matches=[x for x in (c/'packages'/project/'src').rglob('*spec*') if x.is_file() and pattern in x.name]
   assert matches,(name,pattern)
   for x in matches:
    rel=x.relative_to(c);same=h(x)==h(orig/rel);identities.append({'job':name,'path':str(rel),'sha256':h(x),'archive':str(orig/rel),'unchanged':same});assert same,(name,rel)
(r/'TEST-IDENTITIES.json').write_text(json.dumps(identities,indent=2)+'\n')
(r/'VERIFIED.json').write_text(json.dumps({'manifest':expected,'allFiles':len(manifest),'allSelectedTestsExact':True},indent=2)+'\n');print('Verified',len(manifest),'files; exact selected tests',flush=True)
def verify(base):return [p for p,d in manifest.items() if h(base/p)!=d]
results=[]
for name,p in jobs:
 run=r/'runs'/name;run.mkdir(parents=True,exist_ok=False);argv=json.loads(p.read_text())['argv'];env=os.environ.copy()
 for k in list(env):
  if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','VITEST_POOL_ID','VITEST_WORKER_ID']:env.pop(k)
 settings=dict(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),ST_PREPARED_REVIEW_OUTPUT=str(run/'observations'),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(run/'public-observations'),ST_C21_DIAGNOSTIC_OUTPUT=str(run/'diagnostics'),NODE_OPTIONS='--require='+str(r/'diagnostic-redirect.cjs'))
 for k,v in settings.items():
  if k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR'] or k.startswith('ST_'):Path(v).mkdir(parents=True,exist_ok=True)
 env.update(settings);assert not verify(c)
 (run/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'priorCommand':str(p),'ownedGroupCapSeconds':180,'removedInherited':'all ST_*; NODE_PATH; NODE_OPTIONS; VITEST_POOL_ID; VITEST_WORKER_ID'},indent=2)+'\n')
 print('Starting',name,flush=True);t=time.monotonic();timeout=False
 with (run/'first.log').open('x') as log:
  child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (run/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':os.getpgid(child.pid),'supervisorPid':os.getpid()},indent=2)+'\n')
  try:code=child.wait(timeout=180)
  except subprocess.TimeoutExpired:
   timeout=True;os.killpg(child.pid,signal.SIGTERM)
   try:code=child.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait()
 try:os.killpg(child.pid,0);present=True
 except ProcessLookupError:present=False
 post=verify(c);result={'name':name,'exit':code,'timeout':timeout,'elapsedSeconds':time.monotonic()-t,'attempts':1,'sourceMismatches':post,'ownedGroupPresent':present,'manifest':expected}
 (run/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');results.append(result);(r/'STATUS.json').write_text(json.dumps(results,indent=2)+'\n');print(name,code,'unchanged',not post,flush=True)
 if post or present or timeout:break
(r/'FINAL-IDENTITY.json').write_text(json.dumps({'manifest':expected,'candidateMismatches':verify(c),'frozenInputMismatches':verify(b/'candidate')},indent=2)+'\n')
