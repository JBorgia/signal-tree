from pathlib import Path
import json,hashlib,subprocess,os,time,signal,selectors,sys
r=Path(__file__).resolve().parent;c=r/'candidate';consumer=r/'consumer'
env=os.environ.copy();env.update(PATH='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],npm_config_cache=str(r/'npm-cache'),TMPDIR=str(r/'tmp'))
env.update(npm_config_fetch_retries='0',npm_config_fetch_timeout='15000')
for k in ['NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
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
  if p.returncode or watchdog:sys.exit(1)
save('ARTIFACT-HASHES.json',hashes(c/'dist/packages'))
t=r/'tarballs';t.mkdir(exist_ok=True)
for name in ['kernel','angular','react','vue','solid']:run('pack-'+name,['npm','pack','--ignore-scripts','--json','--pack-destination',str(t)],c/'dist/packages'/name)
save('TARBALL-HASHES.json',hashes(t))
peers=['@angular/core','rxjs','react','@types/react','vue','solid-js','tslib','typescript'];versions={n:json.loads((c/'node_modules'/n/'package.json').read_text())['version'] for n in peers};save('PEER-VERSIONS.json',versions)
run('install',['npm','install','--ignore-scripts','--no-audit','--no-fund',*[str(p) for p in sorted(t.glob('*.tgz'))],*[n+'@'+v for n,v in versions.items()]],consumer)

for label,file in [('original8','consumer.mjs'),('lifecycle6','lifecycle-consumer.mjs'),('facade-imports','facade-imports.mjs')]:run(label,['node',file],consumer)
save('PACKED-RESULT.json',{'allChecksPassed':True,'artifactsUnchanged':hashes(c/'dist/packages')==json.loads((r/'ARTIFACT-HASHES.json').read_text())})
