from pathlib import Path
from ownership import OwnedProcesses
import os,subprocess,json,time,hashlib
r=Path(__file__).resolve().parent;d=r/'run-once';d.mkdir(exist_ok=False)
env=os.environ.copy();env['PATH']='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH']
for k in ['NODE_OPTIONS','NODE_PATH']:env.pop(k,None)
env.update(NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false')
for k,p in [('NX_CACHE_DIRECTORY','nx-cache'),('NX_WORKSPACE_DATA_DIRECTORY','nx-data'),('TMPDIR','tmp')]:
 (r/p).mkdir();env[k]=str(r/p)
env.update(ST_RECORDER_OUTPUT=str(d),ST_STAGE_OUTPUT=str(d/'stages.jsonl'),NODE_OPTIONS='--require='+str(r/'record-startup.cjs'))
versions={x:subprocess.check_output(a,env={**env,'NODE_OPTIONS':''},text=True).strip() for x,a in [('node',['node','--version']),('pnpm',['corepack','pnpm','--version'])]};assert versions=={'node':'v24.15.0','pnpm':'10.17.0'}
argv=['corepack','pnpm','nx','test','kernel','src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts','--testNamePattern=^v16 restoration of turns larger than the argument limit jumps across a turn that cleared more rows than the argument limit$','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter='+str(r/'recorder-reporter-v2.mjs')]
(d/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(r/'candidate'),'versions':versions,'noProgressSeconds':180,'env':{k:v for k,v in env.items() if k.startswith(('NX_','ST_')) or k in ['PATH','NODE_OPTIONS','TMPDIR','CI','VITEST_MAX_WORKERS']}},indent=2)+'\n')
# Epoch markers translated to monotonic; reading late never grants extra time.
def progress_time(now_mono,now_epoch,event_ms):return min(now_mono,now_mono-max(0,now_epoch-event_ms/1000))
assert progress_time(100,1000,995000)==95
assert max(80,progress_time(100,1000,995000))==95
assert 274-max(80,95)<180 and 275-max(80,95)>=180
(r/'DEADLINE-CONTROL.json').write_text(json.dumps({'delayedObservationDoesNotExtend':True,'newMarkerResetsLastProgress':True,'boundary179False180True':True})+'\n')
manifest=json.loads((r/'SNAPSHOT-C23.json').read_text());expected={**manifest,**json.loads((r/'INSTRUMENTED-SHA.json').read_text())}
def verify(base,expect):return [p for p,h in expect.items() if hashlib.sha256((base/p).read_bytes()).hexdigest()!=h]
assert not verify(r/'candidate',expected)
with (d/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=r/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 born=time.monotonic();last=born;last_event=None;offsets={};monitor=OwnedProcesses(child.pid,d);trigger=None
 (d/'PROCESS.json').write_text(json.dumps({'launcherPid':child.pid,'runnerPid':os.getpid(),'launchEpoch':time.time()})+'\n')
 def consume():
  global last,last_event
  for name in ['events.jsonl','stages.jsonl']:
   p=d/name
   if not p.exists():continue
   with p.open() as f:
    f.seek(offsets.get(name,0))
    while True:
     pos=f.tell();line=f.readline()
     if not line or not line.endswith('\n'):offsets[name]=pos;break
     event=json.loads(line);offsets[name]=f.tell();t=progress_time(time.monotonic(),time.time(),event['at'])
     if t>last:last=t;last_event={'stream':name,'event':event}
 while child.poll() is None:
  consume();monitor.snapshot();now=time.monotonic()
  if now-last>=180:
   trigger={'reason':'180-seconds-since-last-progress','at':time.time(),'noProgressSeconds':now-last,'lastEvent':last_event}
   (d/'WATCHDOG.json').write_text(json.dumps(trigger,indent=2)+'\n');monitor.terminate()
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   break
  time.sleep(.2)
 consume()
 for _ in range(20):
  rows=monitor.snapshot()
  if not rows:break
  time.sleep(.1)
 result={'exit':child.poll(),'watchdog':trigger,'ownedDescendantsRemain':bool(rows),'lastEvent':last_event}
 (d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n')
checks={'ownMismatches':verify(r/'candidate',expected),'frozenMismatches':verify(Path('/private/tmp/st-native-combined-c23/candidate'),manifest),'files':len(manifest)}
(r/'SOURCE-AFTER.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'result':result,'source':checks}),flush=True)
