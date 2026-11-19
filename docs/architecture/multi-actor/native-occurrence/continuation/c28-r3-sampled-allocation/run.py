from pathlib import Path
import os,json,hashlib,subprocess,time,signal,collections
r=Path(__file__).resolve().parent;h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();test='packages/kernel/src/lib/entity-large-batches.spec.ts';manifests={arm:json.loads((r/arm/'MANIFEST.json').read_text()) for arm in ['baseline','indexed']};template=(r/'INSTRUMENTED-TEMPLATE.spec.ts').read_text()
def verify(arm):
 c=r/arm/'candidate';return [p for p,v in manifests[arm].items() if p!=test and h(c/p)!=v]
def census():
 d={}
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,pgid=,lstart='],text=True).splitlines():
  a=line.split()
  if len(a)>=8:d[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'birth':' '.join(a[3:])}
 return d
census();schedule=[('baseline',2048,1),('indexed',2048,1)];results=[];pids=set();heaplimit=None;previous={}
for arm,n,rep in schedule:
 assert not verify(arm);c=r/arm/'candidate';body=template.replace('const LARGE = 130_000;',f'const LARGE = {n};');assert body!=template;(c/test).write_text(body)
 d=r/'runs'/f'{arm}-{n}-r{rep}';d.mkdir(parents=True,exist_ok=False);(d/'TEST.spec.ts').write_text(body)
 env=os.environ.copy()
 for k in list(env):
  if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','SEMANTICS_REPORT']:env.pop(k)
 settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_CACHE_DIRECTORY':str(d/'cache'),'NX_WORKSPACE_DATA_DIRECTORY':str(d/'data'),'TMPDIR':str(d/'tmp'),'ST_MEMORY_OUTPUT':str(d/'memory.jsonl'),'ST_SUITE_EVENTS':str(d/'events.jsonl')}
 for k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR']:Path(settings[k]).mkdir()
 env.update(settings)
 argv=['corepack','pnpm','nx','test','kernel','src/lib/entity-large-batches.spec.ts','--testNamePattern=^entity batches larger than the argument limit','--skip-nx-cache','--maxWorkers=1','--reporter=default','--reporter=/private/tmp/st-r3-compatibility-inventory/full-reporter.mjs']
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'arm':arm,'size':n,'replicate':rep,'noHeapLimitOverride':True,'testSha256':h(c/test),'manifestSha256':h(r/arm/'MANIFEST.json')},indent=2)+'\n')
 (d/'SOURCE-BEFORE.json').write_text(json.dumps({'runtimeMismatches':verify(arm),'testSha256':h(c/test)},indent=2)+'\n');print('START',arm,n,rep,flush=True)
 start=time.monotonic();last=start;reason=None;owned={};lastRecord=None;memory=[]
 with (d/'first.log').open('x') as log:
  child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);(d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':child.pid,'supervisorPid':os.getpid()},indent=2)+'\n')
  while child.poll() is None:
   now=time.monotonic();ps=census();ids={child.pid}|set(owned)
   while True:
    new={pid for pid,v in ps.items() if v['ppid'] in ids}-ids
    if not new:break
    ids.update(new)
   for pid in ids:
    if pid in ps and pid not in owned:owned[pid]=ps[pid]
   (d/'OWNED.json').write_text(json.dumps(list(owned.values()),indent=2)+'\n')
   records=[]
   for file in ['events.jsonl','memory.jsonl']:
    p=d/file
    if p.exists():
     for line in p.read_text().splitlines():
      try:records.append(json.loads(line))
      except ValueError:pass
   if records:
    lastRecord=max(records,key=lambda x:x['at']);last=now-min(360,max(0,(time.time()*1000-lastRecord['at'])/1000))
   memory=[x for x in records if 'heapUsed' in x]
   if memory and max(x['heapUsed'] for x in memory)>512*1024**2:reason='boundary-heap-over512MiB'
   elif now-start>360:reason='absolute360s'
   elif now-last>180:reason='no-progress180s'
   if reason:break
   time.sleep(1)
  if reason:
   (d/'WATCHDOG.json').write_text(json.dumps({'reason':reason,'lastRecord':lastRecord},indent=2)+'\n')
   for sig in [signal.SIGTERM,signal.SIGKILL]:
    ps=census()
    with (d/'SIGNALS.jsonl').open('a') as f:
     for pid,v in reversed(list(ps.items())):
      if pid in owned and v['birth']==owned[pid]['birth']:
       try:os.kill(pid,sig);f.write(json.dumps({'pid':pid,'birth':v['birth'],'signal':sig.name})+'\n')
       except ProcessLookupError:pass
    time.sleep(5)
   child.wait(timeout=10)
 ps=census();remain=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
 memory=[json.loads(x) for x in (d/'memory.jsonl').read_text().splitlines()] if (d/'memory.jsonl').exists() else []
 ev=[json.loads(x) for x in (d/'events.jsonl').read_text().splitlines()] if (d/'events.jsonl').exists() else []
 cases=[x for e in ev if e['kind']=='module-end' for x in e['cases']];counts=collections.Counter(x['state'] for x in cases);workers={x['pid'] for x in memory};limits={x['heapSizeLimit'] for x in memory};maxheap=max((x['heapUsed'] for x in memory),default=0);initial=memory[0]['heapUsed'] if memory else 0;delta=max(0,maxheap-initial)
 valid=counts.get('passed')==2 and not counts.get('failed') and len(workers)==1 and not pids&workers and len(limits)==1 and (heaplimit is None or limits=={heaplimit}) and memory[-1]['stage']=='restoration:after-destroy'
 if limits and heaplimit is None:heaplimit=next(iter(limits))
 pids.update(workers);source=verify(arm);steep=False
 protocol=[json.loads(x) for x in (d/'protocol.jsonl').read_text().splitlines()] if (d/'protocol.jsonl').exists() else []
 stops=[x for x in protocol if x['kind']=='stop-result'];valid=valid and [x['stage'] for x in stops]==['replacement','undo','redo'] and all(x['synchronous'] and x['startSynchronous'] for x in stops)
 # Fixed caps only, not allocation-slope inference.
 if rep==1:previous[arm]={'n':n,'delta':delta}
 result={'arm':arm,'size':n,'replicate':rep,'exit':child.returncode,'watchdog':reason,'counts':dict(counts),'workerPids':sorted(workers),'heapSizeLimits':sorted(limits),'maxSampledHeapUsed':maxheap,'firstSampleHeapUsed':initial,'sampledPositiveGrowth':delta,'steepGrowthStop':steep,'validTwoCasesAndFreshWorker':valid,'remainingOwned':remain,'runtimeMismatches':source,'testUnchanged':h(c/test)==h(d/'TEST.spec.ts'),'attempts':1}
 (d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');results.append(result);(r/'STATUS.json').write_text(json.dumps(results,indent=2)+'\n');print('END',json.dumps(result),flush=True)
 if child.returncode or reason or remain or source or not valid or steep or maxheap>512*1024**2:break
# Frozen input identities rechecked; no original/candidate input writes.
orig=Path('/private/tmp/st-c28-r3-comparator/candidate');idx=Path('/private/tmp/st-c28-r3-disposition-index/candidate')
(r/'FROZEN-INPUTS-AFTER.json').write_text(json.dumps({arm:[p for p,v in manifests[arm].items() if h(base/p)!=v] for arm,base in [('baseline',orig),('indexed',idx)]},indent=2)+'\n')
