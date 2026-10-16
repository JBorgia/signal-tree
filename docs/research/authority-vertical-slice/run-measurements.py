import pathlib,subprocess,json,hashlib,statistics
r=pathlib.Path('/private/tmp/st-authority-slice-20261016');out=r/'measurements';out.mkdir(exist_ok=True)
node='/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node';rows=[]
for sample in range(3):
 for scenario,size in [('ordinary',32),('ordinary',1024),('transaction',32),('transaction',1024),('overlap',32),('overlap',1024),('observed',32)]:
  arms=['arm-a','arm-b'] if scenario=='overlap' else ['arm-a','arm-b','control']
  if sample%2:arms=arms[::-1]
  for arm in arms:
   cmd=[node,'--expose-gc',str(r/'measure.mjs'),str(r/f'{arm}.mjs'),scenario,str(size),'1000'];p=subprocess.run(cmd,text=True,capture_output=True)
   name=f'{sample}-{scenario}-{size}-{arm}';(out/(name+'.log')).write_text(p.stdout+p.stderr)
   row={'arm':arm,'sample':sample,'scenario':scenario,'size':size,'command':cmd,'exitCode':p.returncode}
   if p.returncode==0:row['result']=json.loads(p.stdout.splitlines()[-1])
   rows.append(row);(out/'raw.json').write_text(json.dumps(rows,indent=2));print(name,p.returncode,flush=True)
summary=[]
for scenario,size in [('ordinary',32),('ordinary',1024),('transaction',32),('transaction',1024),('overlap',32),('overlap',1024),('observed',32)]:
 for arm in ['arm-a','arm-b','control']:
  data=[x['result'] for x in rows if x['arm']==arm and x['scenario']==scenario and x['size']==size and x['exitCode']==0]
  if data:summary.append({'arm':arm,'scenario':scenario,'size':size,'samples':len(data),'metrics':{k:{'median':statistics.median([x[k] for x in data]),'min':min(x[k] for x in data),'max':max(x[k] for x in data)} for k in ['cpuUsPerCycle','wallUsPerCycle','seedHeapDelta','loopHeapDelta','afterHeap']},'stats':data[0]['stats']})
(out/'summary.json').write_text(json.dumps(summary,indent=2))
(out/'source-hashes.json').write_text(json.dumps({f:hashlib.sha256((r/f).read_bytes()).hexdigest() for f in ['arm-a.mjs','arm-b.mjs','control.mjs','measure.mjs','tests.mjs']},indent=2))
