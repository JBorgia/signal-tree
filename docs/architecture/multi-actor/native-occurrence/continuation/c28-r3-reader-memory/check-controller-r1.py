from pathlib import Path
import ast,json,math,collections,hashlib
from types import SimpleNamespace
w=Path(__file__).resolve().parent;p=w/'run-r1.py';tree=ast.parse(p.read_text());assignments={}
for node in ast.walk(tree):
 if isinstance(node,ast.Assign):
  for target in node.targets:
   if isinstance(target,ast.Name):assignments[target.id]=node.value
stop=next(node.test for node in ast.walk(tree) if isinstance(node,ast.If) and "result['testUnchanged']" in ast.unparse(node.test))
def ev(expr,scope):return eval(compile(ast.Expression(expr),str(p),'eval'),scope)
stages=ast.literal_eval(assignments['expectedStages']);names=ast.literal_eval(assignments['expectedNames'])
base=[{'at':i+1,'pid':123,'size':128,'rss':1,'heapTotal':1,'heapUsed':1,'external':1,'arrayBuffers':1,'heapSizeLimit':100,'stage':stage} for i,stage in enumerate(stages)]
cases=[{'name':n,'state':'passed'} for n in sorted(names)]
def valid(memory,cs=cases):
 scope={'math':math,'memory':memory,'n':128,'cases':cs,'expectedStages':stages,'expectedNames':names,'passedNames':{c['name'] for c in cs if c['state']=='passed'},'counts':collections.Counter(c['state'] for c in cs),'workers':{x['pid'] for x in memory},'limits':{x['heapSizeLimit'] for x in memory},'pids':set(),'heaplimit':None}
 scope['numeric']=ev(assignments['numeric'],scope);return bool(ev(assignments['valid'],scope))
def stopped(test=True,source=[]):return bool(ev(stop,{'child':SimpleNamespace(returncode=0),'reason':None,'remain':[],'source':source,'result':{'testUnchanged':test},'valid':True,'steep':False,'maxheap':1}))
checks={'completeExpectedStreamAccepted':valid(base),'testDriftStops':stopped(False),'runtimeDriftStops':stopped(True,['changed.ts']),'cleanDoesNotStop':not stopped(),'singleFinalWrongSizeSampleRejected':not valid([{**base[-1],'size':999}]),'singleFinalCorrectSizeRejected':not valid([base[-1]]),'completeWrongSizeRejected':not valid([{**x,'size':999} for x in base]),'missingStageRejected':not valid(base[1:]),'duplicateStageRejected':not valid(base[:1]+base),'reorderedStagesRejected':not valid(base[1:2]+base[:1]+base[2:]),'nonfiniteRejected':not valid([{**x,'heapUsed':float('nan')} for x in base]),'reversedCasesRejected':not valid(base,list(reversed(cases)))}
# Evaluate the actual result entry; equal drift in live and saved overlays must
# still disagree with the preregistered expected overlay hash.
result=assignments['result'];expr=next(v for k,v in zip(result.keys,result.values) if isinstance(k,ast.Constant) and k.value=='testUnchanged')
checks['equalLiveAndReceiptDriftRejected']=not ev(expr,{'h':lambda p:'changed','c':Path('/live'),'d':Path('/receipt'),'test':'spec.ts','expected':{'testSha256':'registered'}})
output={'controllerSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'method':'Evaluate actual AST validation/stop/result expressions; no controller import, subprocess, Nx, or memory workload','checks':checks,'stageCount':len(stages)}
(w/'CONTROLLER-R1-CHECKS.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps(output,indent=2));assert all(checks.values())
