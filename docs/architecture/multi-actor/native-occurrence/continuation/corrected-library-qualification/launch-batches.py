from pathlib import Path
import json,subprocess,datetime,os
p=Path(__file__).resolve().parent;completed=[];stop=None
for b in json.loads((p/'BATCHES.json').read_text()):
 (p/'STATUS.json').write_text(json.dumps({'phase':b['id']+' running','controllerPid':os.getpid(),'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'completedBatches':completed,'heavySlot':'exclusive'},indent=2)+'\n')
 code=subprocess.run(['python3',str(p/'guarded-run.py'),b['id'],str(b['outerSeconds']),*b['argv']]).returncode
 receipt=p/'runs'/b['id']/'RESULT.json';r=json.loads(receipt.read_text()) if receipt.exists() else None
 if code or not r or r['guardReason'] or r['remainingOwned'] or r['sourceMismatches']:stop={'batch':b['id'],'reason':'operational failure','receipt':r};break
 report=Path(b['report'])
 if not report.exists():stop={'batch':b['id'],'reason':'missing structured report'};break
 q=json.loads(report.read_text());actual=[x['name'] for x in q['testResults']]
 if set(actual)!=set(b['files']) or len(actual)!=len(set(actual)):stop={'batch':b['id'],'reason':'file selection mismatch','missing':sorted(set(b['files'])-set(actual)),'unexpected':sorted(set(actual)-set(b['files']))};break
 summary={'id':b['id'],'exit':r['exit'],'files':len(actual),'tests':q['numTotalTests'],'passed':q['numPassedTests'],'failed':q['numFailedTests'],'pending':q['numPendingTests'],'failures':[{'file':f['name'],'status':f['status'],'message':f.get('message'),'assertions':[a for a in f['assertionResults'] if a['status']=='failed']} for f in q['testResults'] if f['status']=='failed'],'receipt':str(receipt),'report':str(report)}
 completed.append(summary);(p/'BATCH-PROGRESS.json').write_text(json.dumps({'completed':completed,'stop':None},indent=2)+'\n')
(p/'BATCH-PROGRESS.json').write_text(json.dumps({'completed':completed,'stop':stop},indent=2)+'\n');(p/'STATUS.json').write_text(json.dumps({'phase':'kernel batches stopped' if stop else 'kernel batches complete','completedBatches':len(completed),'stop':stop,'runningSession':None,'heavySlot':'exclusive'},indent=2)+'\n');print(json.dumps({'completedBatches':len(completed),'stop':stop}),flush=True)
