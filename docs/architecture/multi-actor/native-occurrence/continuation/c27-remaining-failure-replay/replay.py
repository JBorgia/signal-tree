from pathlib import Path
import os,json,hashlib,shutil,subprocess,time,signal
r=Path(__file__).resolve().parent;b=Path('/private/tmp/st-c27-public-composition');c=r/'candidate';run=r/'runs/composition';run.mkdir(parents=True,exist_ok=False)
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=b/'SNAPSHOT-C27.json';expected='bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd';assert h(m)==expected
manifest=json.loads(m.read_text());shutil.copyfile(m,r/'BASE-MANIFEST.json')
for rel,digest in manifest.items():
 src=b/'candidate'/rel;assert h(src)==digest,rel
 dest=c/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);assert h(dest)==digest
(c/'node_modules').symlink_to('/Users/jonathanborgia/code/signaltree/node_modules',target_is_directory=True)
shutil.copyfile('/private/tmp/st-native-combined-c23/diagnostic-redirect.cjs',r/'diagnostic-redirect.cjs')
prior=json.loads(Path('/private/tmp/st-native-combined-c23/runs/composition/COMMAND.json').read_text());argv=prior['argv']
# All diagnostic output environment is explicitly recorded, including variables omitted from the C23 command record.
env=os.environ.copy()
for k in list(env):
 if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','VITEST_POOL_ID','VITEST_WORKER_ID']:env.pop(k)
settings=dict(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),ST_PREPARED_REVIEW_OUTPUT=str(run/'observations'),ST_PUBLIC_DIAGNOSTIC_OUTPUT=str(run/'public-observations'),ST_C21_DIAGNOSTIC_OUTPUT=str(run/'diagnostics'),NODE_OPTIONS='--require='+str(r/'diagnostic-redirect.cjs'))
for k,v in settings.items():
 if k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR'] or k.startswith('ST_'):Path(v).mkdir(parents=True,exist_ok=True)
env.update(settings)
def verify(base):return [p for p,d in manifest.items() if h(base/p)!=d]
assert not verify(c)
(run/'SOURCE-BEFORE.json').write_text(json.dumps({'manifest':expected,'entries':len(manifest),'mismatches':[]},indent=2)+'\n')
(run/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'removedInherited':'all ST_*; NODE_PATH; prior NODE_OPTIONS; VITEST_POOL_ID/VITEST_WORKER_ID','watchdogSeconds':180,'originalC23Command':str(Path('/private/tmp/st-native-combined-c23/runs/composition/COMMAND.json'))},indent=2)+'\n')
t=time.monotonic();timeout=False
with (run/'first.log').open('x') as log:
 child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 (run/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':os.getpgid(child.pid),'supervisorPid':os.getpid()},indent=2)+'\n')
 try:code=child.wait(timeout=180)
 except subprocess.TimeoutExpired:
  timeout=True;os.killpg(child.pid,signal.SIGTERM)
  try:code=child.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);code=child.wait()
result={'exit':code,'timeout':timeout,'elapsedSeconds':time.monotonic()-t,'attempts':1}
(run/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n')
post={'candidateMismatches':verify(c),'frozenInputMismatches':verify(b/'candidate')};(run/'SOURCE-AFTER.json').write_text(json.dumps(post,indent=2)+'\n')
try:os.killpg(child.pid,0);present=True
except ProcessLookupError:present=False
(run/'GROUP-AFTER.json').write_text(json.dumps({'pgid':child.pid,'present':present},indent=2)+'\n')
print(json.dumps(result));print(json.dumps(post));print('owned group present:',present)
