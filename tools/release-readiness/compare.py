#!/usr/bin/env python3
import hashlib,json,os,shutil,subprocess,sys,time
from pathlib import Path

root=Path(__file__).resolve().parents[2];q=Path(sys.argv[1]);out=q/'matched';out.mkdir(exist_ok=False)
node=shutil.which('node');schedule=[]
profiles=[('ordinary','cpu','jobs','1000'),('ordinary','cpu','products','1000'),('ordinary','heap','jobs','1000'),('coordinated','cpu'),*[('coordinated','heap',str(n)) for n in [1,2,4,8]]]
for profile in profiles:
 for i in range(2):schedule.append({'role':'aa','arm':'baseline','profile':profile})
 for pair in range(5):
  for arm in (['baseline','packed'] if pair%2==0 else ['packed','baseline']):schedule.append({'role':'comparison','arm':arm,'profile':profile})
def bindings():
 paths=[root/'tools/release-economics/ordinary-child.mjs',root/'tools/release-economics/ordinary.mjs',root/'tools/release-economics/coordinated.mjs',root/'tools/lib/heap-quiescence.mjs',root/'tools/release-economics/policy.json',root/'apps/react-reference/src/app/reference-store.ts',root/'apps/demo/src/app/examples/features/fundamentals/examples/entities/entities-demo.component.ts']
 paths+=[root/'tools/release-readiness'/name for name in ['compare.py','coordinated-child.mjs','acceptance.json']]
 for arm in ['baseline','packed']:paths+=list((q/(arm+'-kernel')).rglob('*'))
 return {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
identity=bindings();plan={'createdUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'schedule':schedule,'node':node,'nodeVersion':subprocess.check_output([node,'--version'],text=True).strip(),'host':subprocess.check_output([node,'-p',"require('os').cpus()[0].model"],text=True).strip(),'inputs':identity,'policy':json.loads((root/'tools/release-readiness/acceptance.json').read_text()),'sampling':'Serial fresh processes;2baselineAA then5alternatingpairs; unchanged economics child20/100routes,20/400ordinaryactions,10/100coordinatedworkflows; per-child nearest-rankp95;CPUdescriptive; no pooling/retries; ordinary baseline collection failures retained.'}
(out/'plan.json').write_text(json.dumps(plan,indent=2))
failures=[]
for i,row in enumerate(schedule):
 assert bindings()==identity,'input drift'
 phase,*profile=row['profile'];script=root/('tools/release-economics/ordinary-child.mjs' if phase=='ordinary' else 'tools/release-readiness/coordinated-child.mjs')
 command=[node,'--expose-gc','--max-old-space-size=768',str(script),str(root),str(q),row['arm'],*profile]
 start=time.time();load=os.getloadavg()
 with (out/f'{i:03}.json').open('w') as stdout,(out/f'{i:03}.err').open('w') as stderr:r=subprocess.run(command,stdout=stdout,stderr=stderr,timeout=180)
 data=json.loads((out/f'{i:03}.json').read_text());receipt={**row,'index':i,'exit':r.returncode,'seconds':time.time()-start,'loadBefore':load,'loadAfter':os.getloadavg(),'command':command}
 (out/f'{i:03}.receipt.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt),flush=True)
 if r.returncode:
  failures.append(receipt)
  assert row['arm']=='baseline' and data.get('checks',{}).get('actualResourcesCollected') is False,'candidate or unclassified failure'
 assert bindings()==identity,'input drift'
(out/'complete.json').write_text(json.dumps({'children':len(schedule),'baselineFailures':len(failures),'inputsUnchanged':True},indent=2))
