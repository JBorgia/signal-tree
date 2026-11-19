import os,sys,json,time,signal,subprocess,hashlib
from pathlib import Path
p=Path(__file__).resolve().parent
for n in ['reports','nx-cache','nx-data','tmp']:(p/n).mkdir(exist_ok=True)
node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin'
opts=['--report-on-signal','--report-signal=SIGUSR2','--report-exclude-env','--report-exclude-network','--report-directory='+str(p/'reports')]
env=os.environ.copy();env.update(PATH=node+':'+env['PATH'],NODE_OPTIONS=' '.join(opts),NX_DAEMON='false',NX_ISOLATE_PLUGINS='false',NX_TUI='false',NX_CACHE_DIRECTORY=str(p/'nx-cache'),NX_WORKSPACE_DATA_DIRECTORY=str(p/'nx-data'),TMPDIR=str(p/'tmp'),DEBUG='vite-tsconfig-paths')
for key in ['NODE_PATH','ST_PREPARED_REVIEW_OUTPUT','ST_POINT_ALLOCATION_OUTPUT']:env.pop(key,None)
argv=[node+'/corepack','pnpm','nx','build','react','--skip-nx-cache','--excludeTaskDependencies']
(p/'COMMAND.json').write_text(json.dumps({'argv':argv,'cwd':str(p/'candidate'),'explicitFlags':opts,'nxFlags':{k:env[k] for k in ['NX_DAEMON','NX_ISOLATE_PLUGINS','NX_TUI','NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY']},'deadlineSeconds':180,'reportEligibility':'output emitted, verified own-group Rollup child, at least ten seconds since output observation and two low-CPU samples','watch':False},indent=2)+'\n')
base=json.loads((p/'BASE-MANIFEST.json').read_text())
def identity():return {n:hashlib.sha256((p/'candidate'/n).read_bytes()).hexdigest() for n in base}
before=identity();assert before==base
start=time.monotonic();reported=False;output_at=None;idle=0;stopped=False;events=[]
def owned(pgid):
 r=subprocess.run(['ps','-axo','pid=,ppid=,pgid=,pcpu=,args='],capture_output=True,text=True,check=True)
 rows=[]
 for line in r.stdout.splitlines():
  cells=line.strip().split(None,4)
  if len(cells)==5 and int(cells[2])==pgid:rows.append({'pid':int(cells[0]),'ppid':int(cells[1]),'pgid':int(cells[2]),'pcpu':float(cells[3]),'command':cells[4]})
 return rows
with (p/'first.log').open('w') as f:
 child=subprocess.Popen(argv,cwd=p/'candidate',env=env,stdout=f,stderr=subprocess.STDOUT,start_new_session=True)
 pgid=child.pid
 events.append({'event':'start','pid':child.pid,'pgid':pgid})
 while child.poll() is None:
  rows=owned(pgid);rollups=[r for r in rows if '/rollup/dist/bin/rollup' in r['command'] and '-c rollup.config.cjs' in r['command']]
  raw=(p/'first.log').read_text(errors='replace')
  if 'created ../../dist/packages/react' in raw and output_at is None:
   output_at=time.monotonic();events.append({'event':'output-observed','ownedProcesses':rows});print('React output emitted; observing owned child exit.',flush=True)
  if output_at is not None and rollups:
   idle=idle+1 if all(r['pcpu']<=1 for r in rollups) else 0
   if not reported and len(rollups)==1 and idle>=2 and time.monotonic()-output_at>=10:
    target=rollups[0];assert os.getpgid(target['pid'])==pgid
    cwd=subprocess.run(['lsof','-a','-p',str(target['pid']),'-d','cwd','-Fn'],capture_output=True,text=True).stdout
    if 'n'+str(p/'candidate/packages/react') not in cwd:raise RuntimeError('Rollup cwd does not match owned React candidate')
    events.append({'event':'request-report','target':target,'cwd':str(p/'candidate/packages/react'),'flags':opts});os.kill(target['pid'],signal.SIGUSR2);reported=True;print('Requested one privacy-excluded report from owned Rollup PID '+str(target['pid']),flush=True)
  if time.monotonic()-start>=180:
   events.append({'event':'deadline','ownedProcesses':rows});os.killpg(pgid,signal.SIGTERM);stopped=True;break
  time.sleep(2)
 try:code=child.wait(timeout=5)
 except subprocess.TimeoutExpired:os.killpg(pgid,signal.SIGKILL);code=child.wait()
 remaining=owned(pgid)
 if remaining:
  os.killpg(pgid,signal.SIGKILL);time.sleep(1);remaining=owned(pgid)
checks=[]
for report in sorted((p/'reports').glob('*.json')):
 data=json.loads(report.read_text());bad=[]
 def inspect(x):
  if isinstance(x,dict):
   for k,v in x.items():
    if k in ['environmentVariables','networkInterfaces','localEndpoint','remoteEndpoint'] and v:bad.append(k)
    inspect(v)
  elif isinstance(x,list):
   for v in x:inspect(v)
 inspect(data)
 if bad:report.unlink();checks.append({'file':report.name,'retained':False,'reason':'excluded-data fields unexpectedly nonempty','fieldNames':sorted(set(bad))})
 else:checks.append({'file':report.name,'retained':True,'environmentAndNetworkFieldsExcluded':True})
(p/'PROCESS-EVENTS.json').write_text(json.dumps(events,indent=2)+'\n');(p/'REPORT-PRIVACY.json').write_text(json.dumps(checks,indent=2)+'\n')
after=identity();result={'exit':code,'externallyStoppedAtDeadline':stopped,'oneReportRequested':reported,'outputObserved':output_at is not None,'sourceUnchanged':before==after,'changedSourcePaths':[n for n in before if before[n]!=after[n]],'remainingOwnedProcesses':remaining};(p/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
