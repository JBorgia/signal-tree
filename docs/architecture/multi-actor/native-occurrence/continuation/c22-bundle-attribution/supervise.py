from pathlib import Path
import os,sys,json,time,signal,subprocess,hashlib,re
from ownership import OwnedProcesses
r=Path(__file__).resolve().parent;d=r/'run';d.mkdir(exist_ok=False);packages=['kernel'];node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin'
for n in ['reports','nx-cache','nx-data','tmp','observations']:(r/n).mkdir(exist_ok=True)
flags=['--require='+str(r/'diagnostic-redirect.cjs'),'--report-on-signal','--report-signal=SIGUSR2','--report-exclude-env','--report-exclude-network','--report-directory='+str(r/'reports'),'--require='+str(r/'report-ready.cjs')]
base=json.loads((r/'MAIN-COMMAND.json').read_text());env=os.environ.copy();env.update(base['env']);env.update(PATH=node+':'+env['PATH'],NODE_OPTIONS=' '.join(flags),ST_BUILD_DIAGNOSTIC=str(d),NX_CACHE_DIRECTORY=str(r/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(r/'nx-data'),TMPDIR=str(r/'tmp'),ST_PREPARED_REVIEW_OUTPUT=str(r/'observations'));env.pop('NODE_PATH',None)
argv=[node+'/corepack','pnpm','nx','build','kernel','--skip-nx-cache','--outputStyle=stream']
(d/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(r/'candidate'),'settings':{k:env[k] for k in ['PATH','NODE_OPTIONS','NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_PREPARED_REVIEW_OUTPUT','ST_BUILD_DIAGNOSTIC']},'noProgressSeconds':180,'postEmissionIdleSeconds':30,'idleCpuMaxDeltaSeconds':.2,'oneReportPerPidBirth':True,'progressDefinition':'changed nonempty streamed build output excluding Node report-writing messages; emission belongs to exact named package; diagnostic messages do not reset deadline'},indent=2)+'\n')
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();m=json.loads((r/'BASE-MANIFEST.json').read_text())
def identity():return {p:h(r/'candidate'/p) for p in m}
before=identity();assert before==m;(d/'SOURCE-BEFORE.json').write_text(json.dumps(before,indent=2)+'\n')
reported=set();requested=[];emitted={};events=[];last_text='';timed_out=False;cpu={};observed_nodes={}
def append(name,row):
 with (d/name).open('a') as f:f.write(json.dumps(row)+'\n')
def cpu_seconds(pid):
 raw=subprocess.check_output(['/bin/ps','-p',str(pid),'-o','time='],text=True).strip();parts=raw.split(':');value=0.
 for part in parts:value=value*60+float(part)
 return value
with (d/'first.log').open('w') as log:
 child=subprocess.Popen(argv,cwd=r/'candidate',env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True);born=last_progress=time.monotonic();assert os.getpgid(child.pid)==child.pid
 monitor=OwnedProcesses(child.pid,d);(d/'PROCESS.json').write_text(json.dumps({'runnerPid':os.getpid(),'childPid':child.pid,'ownedPgid':child.pid},indent=2)+'\n')
 while True:
  monitor.snapshot();state=json.loads((d/'OWNERSHIP.json').read_text());live=state['live'];now=time.monotonic()
  raw=re.sub(r'\x1b\[[0-9;]*m','',(d/'first.log').read_text(errors='replace'))
  meaningful='\n'.join(line for line in raw.splitlines() if line.strip() and not any(x in line for x in ['Writing Node.js report','Node.js report completed']))
  if meaningful!=last_text:
   last_text=meaningful;last_progress=now;append('progress.jsonl',{'at':time.time(),'kind':'build-output','byteLength':len(raw),'lastLines':meaningful.splitlines()[-3:]})
  for package in re.findall(r'created\s+(?:\.\./)+dist/packages/(kernel|angular|react|vue|solid)\b',raw):
   if package not in emitted:
    emitted[package]=now;append('progress.jsonl',{'at':time.time(),'kind':'emission','package':package});print(package+' emission observed',flush=True)
  p=d/'node-ready.jsonl'
  if p.exists():
   for line in p.read_text().splitlines():
    try:x=json.loads(line);observed_nodes[x['pid']]=x
    except json.JSONDecodeError:pass
  if child.poll() is not None and not live:break
  rollups=[row for row in live if '/rollup/dist/bin/rollup' in row['raw'] and 'rollup.config.cjs' in row['raw']]
  candidates=rollups or [row for row in live if '/nx/dist/bin/nx.js' in row['raw']]
  for target in candidates:
   key=(target['pid'],target['birth']);att=observed_nodes.get(target['pid']);kind='rollup' if target in rollups else 'nx-coordinator'
   if not att:continue
   expected_cwd=att['cwd'];package=Path(expected_cwd).name if kind=='rollup' else None
   if kind=='rollup' and (package not in emitted or expected_cwd!=str(r/'candidate/packages'/package)):continue
   if kind=='nx-coordinator' and (not emitted or expected_cwd!=str(r/'candidate')):continue
   try:used=cpu_seconds(target['pid'])
   except (subprocess.CalledProcessError,ValueError):continue
   samples=cpu.setdefault(key,[]);samples.append((now,used));samples[:]=[x for x in samples if now-x[0]<=45]
   append('cpu-observations.jsonl',{'at':time.time(),'pid':target['pid'],'birth':target['birth'],'kind':kind,'package':package,'cpuSeconds':used})
   old=[x for x in samples if now-x[0]>=30]
   since_emit=now-(emitted[package] if package else max(emitted.values()))
   if key in reported or since_emit<30 or now-last_progress<30 or not old or used-old[-1][1]>.2:continue
   expected_report={'onSignal':True,'signal':'SIGUSR2','excludeEnv':True,'excludeNetwork':True,'directory':str(r/'reports')}
   valid=att['node']=='v24.15.0' and att['report']==expected_report
   cwd=subprocess.run(['/usr/sbin/lsof','-a','-p',str(target['pid']),'-d','cwd','-Fn'],capture_output=True,text=True)
   current=monitor.scan().get(target['pid']);valid=valid and cwd.returncode==0 and 'n'+expected_cwd in cwd.stdout.splitlines() and current and current['birth']==target['birth'] and current['pgid'] in monitor.groups
   if valid:
    record={'event':'report-request','at':time.time(),'target':target,'kind':kind,'package':package,'cwd':cwd.stdout,'attestation':att,'idleWindowSeconds':now-old[-1][0],'cpuDeltaSeconds':used-old[-1][1]};requested.append(record);reported.add(key);append('report-requests.jsonl',record);os.kill(target['pid'],signal.SIGUSR2);print('Requested one excluded-data report: '+kind+' PID '+str(target['pid']),flush=True)
  if now-last_progress>=180:
   timed_out=True;event={'event':'no-progress-deadline','at':time.time(),'secondsSinceProgress':now-last_progress,'emittedPackages':list(emitted),'live':live};(d/'WATCHDOG.json').write_text(json.dumps(event,indent=2)+'\n');monitor.terminate()
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
   break
  time.sleep(1)
 code=child.poll()
 for _ in range(50):
  remaining=monitor.snapshot()
  if not remaining:break
  time.sleep(.1)
checks=[]
for p in sorted((r/'reports').glob('*.json')):
 data=json.loads(p.read_text());raw_hash=h(p);bad=[]
 def scrub(x):
  if isinstance(x,dict):
   for k in list(x):
    if k in ['environmentVariables','networkInterfaces','localEndpoint','remoteEndpoint']:
     if x[k]:bad.append(k)
     del x[k]
    else:scrub(x[k])
  elif isinstance(x,list):
   for y in x:scrub(y)
 scrub(data)
 if bad:p.write_text(json.dumps(data,indent=2)+'\n')
 checks.append({'file':p.name,'pid':data.get('header',{}).get('processId'),'rawSha256':raw_hash,'retainedSha256':h(p),'unexpectedExcludedFields':sorted(set(bad)),'privacyExclusionsVerified':not bad})
(d/'REPORT-PRIVACY.json').write_text(json.dumps(checks,indent=2)+'\n')
after=identity();(d/'SOURCE-AFTER.json').write_text(json.dumps(after,indent=2)+'\n')
outputs={}
for package in packages:
 folder=r/'candidate/dist/packages'/package;outputs[package]={str(p.relative_to(folder)):h(p) for p in folder.rglob('*') if p.is_file()} if folder.exists() else {}
(d/'ARTIFACT-IDENTITY.json').write_text(json.dumps(outputs,indent=2)+'\n')
result={'exit':code,'noProgressTimeout':timed_out,'emittedPackages':list(emitted),'allFiveEmitted':set(emitted)==set(packages),'allFiveHaveArtifacts':all(outputs.values()),'normalFullChainExit':code==0 and not timed_out and not remaining and set(emitted)==set(packages) and all(outputs.values()),'sourceUnchanged':before==after,'changedSourcePaths':[p for p in m if before[p]!=after[p]],'reportRequests':len(requested),'reports':checks,'remainingObservedDescendants':remaining,'elapsedExecutionSeconds':time.monotonic()-born}
(d/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
raise SystemExit(124 if timed_out else code if code is not None else 125)
