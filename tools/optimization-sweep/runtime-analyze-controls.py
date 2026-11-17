#!/usr/bin/env python3
"""Admission controls against copied metadata; source cohorts are read-only."""
import copy,hashlib,json,pathlib,subprocess,sys
source,out=(pathlib.Path(s).resolve() for s in sys.argv[1:]);out.mkdir(exist_ok=False)
script=pathlib.Path(__file__).with_name('runtime-analyze.py')
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.file_digest(p.open('rb'),'sha256').hexdigest()
write=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n')
results=[]
for fault,expected in [('healthy',None),('wrong-row','exact-schedule'),('wrong-aa','exact-schedule'),('missing-binding','missing-packet-input-binding'),('cleanup','child-error'),('signal','invocation-error'),('log-drift','bound-payload-hash')]:
    target=out/fault;target.mkdir()
    result=copy.deepcopy(read(source/'results.json'));schedule=copy.deepcopy(read(pathlib.Path(result['schedulePath'])))
    for index,inv in enumerate(result['results']):
        original=read(pathlib.Path(inv['resultPath']));p=target/f'child-{index}.json';write(p,original)
        inv['resultPath']=str(p);inv['resultSha256']=sha(p)
        log=target/f'child-{index}.log';log.write_bytes(pathlib.Path(inv['log']).read_bytes());inv['log']=str(log)
    if fault=='wrong-row':schedule['schedule'][0]['rows']=999
    if fault=='wrong-aa':schedule['schedule'][2]['arm']='candidate'
    if fault=='missing-binding':
        packet=read(pathlib.Path(schedule['packets']['baseline'])/'packet.json')
        path=packet['bundles']['bare']['path'];del schedule['bindings'][path];del result['bindings'][path]
    if fault=='cleanup':
        inv=result['results'][0];p=pathlib.Path(inv['resultPath']);child=read(p);child['cleanupError']='planted';write(p,child);inv['resultSha256']=sha(p)
    if fault=='signal':result['results'][0]['signal']='SIGTERM'
    if fault=='log-drift':pathlib.Path(result['results'][0]['log']).write_text('planted')
    for index,inv in enumerate(result['results']):write(target/f'invocation-{index}.json',inv)
    schedule_path=target/'schedule.json';write(schedule_path,schedule);result['schedulePath']=str(schedule_path);result['scheduleSha256']=sha(schedule_path);write(target/'results.json',result)
    run=subprocess.run([sys.executable,str(script),str(target),str(target/'analysis.json')],text=True,capture_output=True)
    (target/'analysis.log').write_text(run.stdout+run.stderr)
    passed=run.returncode==0 if expected is None else run.returncode!=0 and expected in run.stderr
    results.append(dict(fault=fault,expected=expected,exitCode=run.returncode,passed=passed,logSha256=sha(target/'analysis.log')))
    assert passed, (fault,run.stdout,run.stderr)
write(out/'controls.json',dict(passed=True,analyzer=str(script),analyzerSha256=sha(script),source=str(source),results=results))
print(json.dumps(results))
