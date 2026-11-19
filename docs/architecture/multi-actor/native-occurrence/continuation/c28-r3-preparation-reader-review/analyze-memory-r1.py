from pathlib import Path
import json,hashlib,math,re
w=Path('/private/tmp/st-c28-r3-reader-memory');r=w/'R1';o=Path(__file__).parent
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ident=json.loads((r/'IDENTITY.json').read_text());cmds=json.loads((r/'COMMANDS.json').read_text());template=(w/'INSTRUMENTED-TEMPLATE.spec.ts').read_text();stages=re.findall(r"memoryStage\('([^']+)'\)",template)
assert h(w/'run-r1.py')==ident['controller'];assert h(r/'COMMANDS.json')==ident['commands'];assert h(w/'INSTRUMENTED-TEMPLATE.spec.ts')==ident['template']
rows=[];pids=set();limits=set();prior={};failures=[]
for c in cmds:
 d=Path(c['runDir']);f=d/'RESULT.json'
 if not f.exists():break
 result=json.loads(f.read_text());memory=[json.loads(l) for l in (d/'memory.jsonl').read_text().splitlines()] if (d/'memory.jsonl').exists() else [];events=[json.loads(l) for l in (d/'events.jsonl').read_text().splitlines()] if (d/'events.jsonl').exists() else []
 cases=[x for e in events if e['kind']=='module-end' for x in e['cases']];actual=json.loads((d/'COMMAND.json').read_text());checks={'commandMatches':actual['argv']==c['argv'] and actual['cwd']==c['cwd'],'testHashMatches':h(d/'TEST.spec.ts')==c['testSha256'],'completeStages':[x.get('stage') for x in memory]==stages,'matchingSizes':bool(memory) and all(x['size']==c['size'] for x in memory),'finiteNumbers':bool(memory) and all(isinstance(x.get(k),(int,float)) and not isinstance(x.get(k),bool) and math.isfinite(x[k]) for x in memory for k in ['at','pid','size','rss','heapTotal','heapUsed','external','arrayBuffers','heapSizeLimit'])}
 workers={x['pid'] for x in memory};checks['freshSingleWorker']=len(workers)==1 and not workers&pids;pids.update(workers);limits.update(x['heapSizeLimit'] for x in memory);checks['sameHeapLimit']=len(limits)==1
 checks['exactPassedNames']=[x['name'] for x in cases if x['state']=='passed']==['entity batches larger than the argument limit > setAll, replace and clear with membership observed','entity batches larger than the argument limit > undo and redo of a setAll that replaced every row'] and not any(x['state']=='failed' for x in cases)
 if memory:
  initial=memory[0]['heapUsed'];maximum=max(x['heapUsed'] for x in memory);growth=max(0,maximum-initial);old=prior.get(c['arm']);steep=bool(old and c['size']>old['size'] and growth>64*1024**2 and growth>8*old['growth']);over=maximum>512*1024**2
  if c['replicate']==1:prior[c['arm']]={'size':c['size'],'growth':growth}
 else:initial=maximum=growth=0;steep=over=False
 checks['computedGrowthMatches']=growth==result['sampledPositiveGrowth'];checks['computedStopMatches']=steep==result['steepGrowthStop'];checks['cleanRecordedSources']=not result['runtimeMismatches'] and result['testUnchanged'];checks['cleanOwned']=not result['remainingOwned']
 row={'arm':c['arm'],'size':c['size'],'replicate':c['replicate'],'exit':result['exit'],'watchdog':result['watchdog'],'workerPids':sorted(workers),'initialHeap':initial,'maxSampledHeap':maximum,'positiveBoundaryGrowth':growth,'over512MiB':over,'steepStop':steep,'checks':checks,'phases':[{'stage':x['stage'],'heapUsed':x['heapUsed'],'deltaFromMembershipStart':x['heapUsed']-initial} for x in memory]};rows.append(row)
 if not all(checks.values()) or result['exit'] or result['watchdog'] or over or steep:failures.append(d.name)
summary={'controller':ident['controller'],'completedRecords':len(rows),'runDirectories':[p.name for p in (r/'runs').iterdir() if p.is_dir()],'uniqueWorkerPids':sorted(pids),'heapSizeLimits':sorted(limits),'failuresOrStops':failures,'runs':rows}
(o/'MEMORY-R1-INDEPENDENT-CALCULATION.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='runs'},indent=2))
