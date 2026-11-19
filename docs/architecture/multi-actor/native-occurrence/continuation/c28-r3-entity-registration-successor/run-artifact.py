from pathlib import Path
import json,hashlib,subprocess,os,time,signal,selectors,sys
r=Path(__file__).resolve().parent;c=r/'candidate';consumer=r/'consumer'
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],npm_config_cache=str(r/'npm-cache'),TMPDIR=str(r/'tmp'))
env.update(NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_NO_CLOUD='true',NX_TUI='false',NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),npm_config_fetch_retries='0',npm_config_fetch_timeout='15000')
for k in ['NX_WORKSPACE_ROOT_PATH','NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
def save(n,v):(r/n).write_text(json.dumps(v,indent=2)+'\n')
def hashes(d):return {str(p.relative_to(d)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(d.rglob('*')) if p.is_file()}
def run(name,argv,cwd):
 save(name+'-command.json',{'argv':argv,'cwd':str(cwd),'noProgressSeconds':180})
 with (r/(name+'-first.log')).open('wb') as log:
  p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True);save(name+'-process.json',{'pid':p.pid,'pgid':p.pid});s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);last=time.monotonic();watchdog=False
  while True:
   for key,_ in s.select(.5):
    data=os.read(key.fileobj.fileno(),65536)
    if data:log.write(data);log.flush();print(data.decode(errors='replace'),end='',flush=True);last=time.monotonic()
    else:s.unregister(key.fileobj)
   if p.poll() is not None and not s.get_map():break
   if time.monotonic()-last>180:
    watchdog=True
    try:os.killpg(p.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:p.wait(timeout=5)
    except subprocess.TimeoutExpired:pass
    try:os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    break
  p.wait();save(name+'-result.json',{'exit':p.returncode,'watchdog':watchdog})
  return p.returncode if not watchdog else 124

if __name__=='__main__':
 name=sys.argv[1];argv=sys.argv[2:]
 before=hashes(c/'dist/packages');source=json.loads((r/'MANIFEST.json').read_text())
 code=run(name,argv,c)
 save(name+'-identity.json',{'sourceUnchanged':all(hashlib.sha256((c/f).read_bytes()).hexdigest()==h for f,h in source.items()),'artifactsUnchanged':hashes(c/'dist/packages')==before})
 sys.exit(code)
