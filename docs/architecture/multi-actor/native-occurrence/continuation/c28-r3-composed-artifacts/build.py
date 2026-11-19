from pathlib import Path
import json,hashlib,subprocess,os,time,signal,selectors
r=Path(__file__).resolve().parent;c=r/'candidate';mfile=r/'MANIFEST.json';expected='2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd';assert hashlib.sha256(mfile.read_bytes()).hexdigest()==expected;m=json.loads(mfile.read_text())
def save(name,v):(r/name).write_text(json.dumps(v,indent=2)+'\n')
def identity():return {p:hashlib.sha256((c/p).read_bytes()).hexdigest() for p in m}
before=identity();assert before==m;save('SOURCE-BEFORE.json',before)
assert not (c/'dist/packages').exists(),'Fresh build requires preserving preexisting artifacts first; no deletion performed'
for d in ['tmp','nx-cache','nx-data','npm-cache']:(r/d).mkdir()
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),npm_config_cache=str(r/'npm-cache'))
for k in ['NX_WORKSPACE_ROOT_PATH','NODE_OPTIONS','NODE_PATH','ST_PREPARED_REVIEW_OUTPUT','ST_GC_OUTPUT']:env.pop(k,None)
argv=['corepack','pnpm','nx','run-many','-t','build','--projects=kernel,angular,react,vue,solid','--parallel=1','--skip-nx-cache','--output-style=stream','--nxBail'];save('BUILD-COMMAND.json',{'cwd':str(c),'argv':argv,'node':'24.15.0','pnpm':'10.17.0','noOutputWatchdogSeconds':180,'manifestSha256':expected})
trigger=None
with (r/'build-first.log').open('wb') as log:
 p=subprocess.Popen(argv,cwd=c,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);save('BUILD-PROCESS.json',{'supervisor':os.getpid(),'pid':p.pid,'pgid':p.pid});sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);last=time.monotonic()
 while True:
  for key,_ in sel.select(timeout=.5):
   chunk=os.read(key.fileobj.fileno(),65536)
   if chunk:log.write(chunk);log.flush();print(chunk.decode(errors='replace'),end='',flush=True);last=time.monotonic()
   else:sel.unregister(key.fileobj)
  if p.poll() is not None and not sel.get_map():break
  if time.monotonic()-last>180:
   trigger={'reason':'no-output-180s','pgid':p.pid};save('BUILD-WATCHDOG.json',trigger)
   try:os.killpg(p.pid,signal.SIGTERM)
   except ProcessLookupError:pass
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:pass
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   break
 p.wait()
after=identity();save('SOURCE-AFTER-BUILD.json',after);save('BUILD-RESULT.json',{'exit':p.returncode,'watchdog':trigger,'sourceUnchanged':after==m,'changed':[p for p in m if after[p]!=m[p]]});print('BUILD RESULT',p.returncode,flush=True)
