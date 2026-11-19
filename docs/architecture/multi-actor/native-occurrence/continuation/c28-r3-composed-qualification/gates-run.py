from pathlib import Path
import os,json,hashlib,subprocess,time,signal
r=Path(__file__).resolve().parent;c=r/'candidate';frozen=Path('/private/tmp/st-c28-r3-composition/candidate');manifest=json.loads((r/'BASE-MANIFEST.json').read_text());expected='2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd'
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def verify(base):return [p for p,v in manifest.items() if h(base/p)!=v]
def census():
 raw=subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,pgid=,lstart='],text=True)
 d={}
 for line in raw.splitlines():
  a=line.split();
  if len(a)>=8:d[int(a[0])]={'pid':int(a[0]),'ppid':int(a[1]),'pgid':int(a[2]),'birth':' '.join(a[3:])}
 return d
# Fail before launching tests if owned-process observation is unavailable.
census();statuses=[]
jobs=[('source-types', ['corepack', 'pnpm', 'exec', 'tsc', '--noEmit', '-p', 'tsconfig.typecheck-all.json']), ('public-types', ['corepack', 'pnpm', 'exec', 'tsc', '--noEmit', '-p', 'packages/kernel/tsconfig.typecheck.json']), ('spec-types', ['corepack', 'pnpm', 'exec', 'node', 'tools/check-spec-types.mjs']), ('affected-lint', ['corepack', 'pnpm', 'exec', 'eslint', 'packages/kernel/src/enhancers/restoration/restoration.spec.ts', 'packages/kernel/src/enhancers/restoration/restoration.ts', 'packages/kernel/src/enhancers/transactions/transaction-lifecycle-view.spec.ts', 'packages/kernel/src/enhancers/transactions/transactions.ts', 'packages/kernel/src/lib/dynamic-admission-minimal.spec.ts', 'packages/kernel/src/lib/equal-owner-public-adversaries.spec.ts', 'packages/kernel/src/lib/equal-owner-retention-diagnostic.spec.ts', 'packages/kernel/src/lib/initializer-attachment-independent.spec.ts', 'packages/kernel/src/lib/initializer-owned-cleanup.spec.ts', 'packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts', 'packages/kernel/src/lib/internals/intercept-leaf-signals.ts', 'packages/kernel/src/lib/internals/intrinsic-mutation.ts', 'packages/kernel/src/lib/internals/mutation-capture-runtime.ts', 'packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts', 'packages/kernel/src/lib/internals/owned-mutation.ts', 'packages/kernel/src/lib/internals/plain-branch-membership.ts', 'packages/kernel/src/lib/internals/realization-admission-metadata.spec.ts', 'packages/kernel/src/lib/internals/scalar-admission-metadata.ts', 'packages/kernel/src/lib/internals/scalar-responsibility-attachment.ts', 'packages/kernel/src/lib/internals/tree-scalar-leaf-runtime.ts', 'packages/kernel/src/lib/internals/tree-scalar-slot-port.ts', 'packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts', 'packages/kernel/src/lib/link-commit-ordering.spec.ts', 'packages/kernel/src/lib/opaque-leaf-restoration-v16-controls.spec.ts', 'packages/kernel/src/lib/scalar-responsibility-lifecycle.spec.ts', 'packages/kernel/src/lib/transaction-observer-failure.spec.ts', 'packages/react/src/branch-declaration-qualification.spec.tsx'])]
for project,argv in jobs:
 assert not verify(c) and not verify(frozen)
 d=r/'gates'/project;d.mkdir(parents=True,exist_ok=False);env=os.environ.copy()
 for k in list(env):
  if k.startswith('ST_') or k in ['NODE_OPTIONS','NODE_PATH','SEMANTICS_REPORT']:env.pop(k)
 settings={'PATH':'/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:'+env['PATH'],'NX_DAEMON':'false','NX_ISOLATE_PLUGINS':'false','NX_NO_CLOUD':'true','NX_TUI':'false','NX_CACHE_DIRECTORY':str(r/'full-cache'),'NX_WORKSPACE_DATA_DIRECTORY':str(r/'full-data'),'TMPDIR':str(d/'tmp'),'ST_PREPARED_REVIEW_OUTPUT':str(d/'observations'),'ST_PUBLIC_DIAGNOSTIC_OUTPUT':str(d/'public'),'ST_C21_DIAGNOSTIC_OUTPUT':str(d/'redirected'),'ST_TWO_HISTORY_OUTPUT':str(d/'two-history.jsonl'),'ST_EQUAL_OWNER_TRACE':str(d/'equal-owner.jsonl'),'ST_SUITE_EVENTS':str(d/'events.jsonl')}
 for k in ['NX_CACHE_DIRECTORY','NX_WORKSPACE_DATA_DIRECTORY','TMPDIR','ST_PREPARED_REVIEW_OUTPUT','ST_PUBLIC_DIAGNOSTIC_OUTPUT','ST_C21_DIAGNOSTIC_OUTPUT']:Path(settings[k]).mkdir(parents=True,exist_ok=True)
 # No test diagnostic preload needed for type/lint gates.
 env.update(settings)
 (d/'COMMAND.json').write_text(json.dumps({'cwd':str(c),'argv':argv,'env':settings,'angularTargetRetainsOwnExposeGC':project=='angular','timeouts':{'startupSeconds':180,'noProgressSeconds':180,'absoluteSeconds':180},'scope':'all discovered ordinary files except two explicitly tracked kernel large gates; see EXCLUSIONS.json'},indent=2)+'\n')
 (d/'SOURCE-BEFORE.json').write_text(json.dumps({'manifest':expected,'entries':len(manifest),'mismatches':[]},indent=2)+'\n')
 print('START',project,flush=True);start=time.monotonic();last=start;pos=0;buf='';lastEvent=None;reason=None;owned={}
 with (d/'first.log').open('x') as log:
  child=subprocess.Popen(argv,cwd=c,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (d/'PROCESS.json').write_text(json.dumps({'pid':child.pid,'pgid':child.pid,'supervisorPid':os.getpid()},indent=2)+'\n')
  while child.poll() is None:
   now=time.monotonic();ps=census();ids={child.pid}|set(owned)
   changed=True
   while changed:
    new={pid for pid,v in ps.items() if v['ppid'] in ids}-ids;changed=bool(new);ids.update(new)
   for pid in ids:
    if pid in ps and pid not in owned:owned[pid]=ps[pid]
   (d/'OWNED.json').write_text(json.dumps(list(owned.values()),indent=2)+'\n')
   events=d/'events.jsonl'
   if events.exists():
    with events.open() as stream:stream.seek(pos);data=stream.read();pos=stream.tell()
    buf+=data
    while '\n' in buf:
     line,buf=buf.split('\n',1)
     try:ev=json.loads(line)
     except ValueError:continue
     lastEvent=ev;last=now-min(180,max(0,(time.time()*1000-ev['at'])/1000))
   if now-start>180:reason='absolute-180s'
   elif now-last>180:reason='no-progress-180s' if lastEvent else 'startup-180s'
   if reason:break
   time.sleep(1)
  if reason:
   (d/'WATCHDOG.json').write_text(json.dumps({'reason':reason,'lastEvent':lastEvent,'elapsedSeconds':time.monotonic()-start},indent=2)+'\n')
   for sig in [signal.SIGTERM,signal.SIGKILL]:
    ps=census();targets=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
    with (d/'SIGNALS.jsonl').open('a') as f:
     for v in reversed(targets):
      try:os.kill(v['pid'],sig);f.write(json.dumps({'pid':v['pid'],'birth':v['birth'],'signal':sig.name})+'\n')
      except ProcessLookupError:pass
    time.sleep(5)
   child.wait(timeout=10)
 code=child.returncode;ps=census();remain=[v for pid,v in ps.items() if pid in owned and v['birth']==owned[pid]['birth']]
 after={'candidateMismatches':verify(c),'frozenMismatches':verify(frozen)};(d/'SOURCE-AFTER.json').write_text(json.dumps(after,indent=2)+'\n')
 res={'project':project,'exit':code,'watchdog':reason,'elapsedSeconds':time.monotonic()-start,'remainingOwned':remain,'sourceUnchanged':not any(after.values()),'attempts':1}
 (d/'RESULT.json').write_text(json.dumps(res,indent=2)+'\n');statuses.append(res);(r/'GATE-STATUS.json').write_text(json.dumps(statuses,indent=2)+'\n');print('END',json.dumps(res),flush=True)
 if reason or remain or not res['sourceUnchanged'] or code is not None and code<0:break
