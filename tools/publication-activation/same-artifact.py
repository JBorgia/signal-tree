#!/usr/bin/env python3
"""Fresh same-artifact controls for the exact active-wide workload.

PACKET_JSON NEW_OUTPUT; no build, mutation, publication or profiler. This is a
variation diagnostic, not an A/B speedup or a confidence interval.
"""
import datetime,hashlib,json,os,subprocess,sys,time
from pathlib import Path
packet_path,out=map(lambda x:Path(x).resolve(),sys.argv[1:]);assert not out.exists();out.mkdir()
read=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.file_digest(Path(p).open('rb'),'sha256').hexdigest()
def save(path,value):
 with path.open('x') as f:json.dump(value,f,indent=2);f.write('\n')
packet=read(packet_path)
profile=next(p for p in packet['config']['profiles'] if p['id']=='initial-10k32-followup')
def guard():
 for path,digest in packet['bindings'].items():assert sha(path)==digest,path
 assert sha(packet_path)==plan['packetSha256']
schedule=[]
for kind,pairs in [('cpu',3),('heap',2)]:
 for pair in range(pairs):
  for arm in (['baseline','candidate'] if pair%2==0 else ['candidate','baseline']):
   for repeat in range(2):schedule.append({'kind':kind,'arm':arm,'pair':pair,'repeat':repeat})
plan={'packet':str(packet_path),'packetSha256':sha(packet_path),'runner':str(Path(__file__).resolve()),'runnerSha256':sha(__file__),'startedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'profile':profile,'schedule':schedule,'scope':'Same-artifact fresh-process variation controls: each pair uses identical bundle bytes. CPU and exposed-GC heap are separate. No runtime changes. Retain all observations; not a confidence interval.'}
save(out/'plan.json',plan);records=[];expected=None
for index,selection in enumerate(schedule):
 guard();location=out/f'{index:03d}';location.mkdir();kind=selection['kind'];arm=selection['arm']
 sample={'index':index,'arm':arm,'kind':kind,'profile':profile,'round':selection['pair']}
 result_path=location/'result.json';log=location/'command.log'
 command=[packet['node']['path'],*(['--expose-gc'] if kind=='heap' else []),packet['runner'],'child',packet['executionPath'],str(result_path),json.dumps(sample,separators=(',',':'))]
 save(location/'command.json',{'command':command,'selection':selection,'packetSha256':sha(packet_path)})
 started=time.monotonic()
 with log.open('xb') as f:child=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT,timeout=600,env={**os.environ,'NODE_OPTIONS':''})
 assert child.returncode==0,(index,child.returncode)
 result=read(result_path);assert result['passed'] and 'error' not in result and 'cleanupError' not in result
 assert result['sample']==sample and result['node']==packet['node']['version']
 assert result['bundleSha256']==packet['bundles'][arm]['loaded']['sha256']
 assert result['executionSha256']==packet['executionSha256']
 oracles={k:v for k,v in result['oracles'].items() if k!='release'}
 if expected is None:expected=oracles
 else:assert oracles==expected,'Identical semantic observations'
 if kind=='cpu':assert not result['checkpoints'] and result['episode']['cpuMs']>0 and result['stages']['historyMutation']['calls']==8
 else:assert not result['stages'] and set(result['checkpoints']['helperReturned']['alive'])=={'tree','snapshot'}
 records.append({**selection,'index':index,'seconds':time.monotonic()-started,'resultPath':str(result_path),'resultSha256':sha(result_path),'log':str(log),'logSha256':sha(log)})
 print(json.dumps({'index':index,**selection,'passed':True}),flush=True)
guard();comparisons=[]
for kind,pairs in [('cpu',3),('heap',2)]:
 for arm in ['baseline','candidate']:
  for pair in range(pairs):
   entries=[r for r in records if r['kind']==kind and r['arm']==arm and r['pair']==pair]
   assert len(entries)==2
   a,b=[read(r['resultPath']) for r in entries]
   if kind=='cpu':values={'episodeCpuMs':[a['episode']['cpuMs'],b['episode']['cpuMs']],**{p+'.cpuMs':[a['stages'][p]['cpuMs'],b['stages'][p]['cpuMs']] for p in ['population','historyMutation']}}
   else:values={p+'.deltaBytes':[x['checkpoints'][p]['heapBytes']-x['checkpoints']['moduleReady']['heapBytes'] for x in [a,b]] for p in ['populated','contextHeld','historyHeld','destroyedHeld','helperReturned']}
   comparisons.append({'kind':kind,'arm':arm,'pair':pair,'values':values,'secondMinusFirst':{k:v[1]-v[0] for k,v in values.items()}})
save(out/'result.json',{'plan':str(out/'plan.json'),'planSha256':sha(out/'plan.json'),'passed':True,'records':records,'comparisons':comparisons,'limits':plan['scope']})
