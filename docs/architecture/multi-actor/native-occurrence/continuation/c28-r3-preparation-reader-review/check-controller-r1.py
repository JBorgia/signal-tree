import ast,copy,hashlib,json,math,re
from pathlib import Path
p=Path('/private/tmp/st-c28-r3-reader-memory/run-r1.py');tree=ast.parse(p.read_text());loop=next(x for x in tree.body if isinstance(x,ast.For) and isinstance(x.target,ast.Tuple));assign=lambda name:next(x.value for x in loop.body if isinstance(x,ast.Assign) and any(isinstance(y,ast.Name) and y.id==name for y in x.targets));stop=next(x.test for x in loop.body if isinstance(x,ast.If) and any(isinstance(y,ast.Break) for y in x.body));stages=ast.literal_eval(next(x.value for x in tree.body if isinstance(x,ast.Assign) and any(isinstance(y,ast.Name) and y.id=='expectedStages' for y in x.targets)));template=(p.parent/'INSTRUMENTED-TEMPLATE.spec.ts').read_text();assert stages==re.findall(r"memoryStage\('([^']+)'\)",template)
names=ast.literal_eval(assign('expectedNames'));sample={k:1 for k in ['at','pid','rss','heapTotal','heapUsed','external','arrayBuffers','heapSizeLimit']};sample['size']=128
base={'math':math,'passedNames':names,'expectedNames':names,'counts':{'passed':2},'cases':[{'name':x,'state':'passed'} for x in sorted(names)],'workers':{1},'pids':set(),'limits':{1},'heaplimit':1,'memory':[dict(sample,stage=s) for s in stages],'expectedStages':stages,'child':type('Child',(),{'returncode':0})(),'reason':None,'remain':[],'source':[],'steep':False,'maxheap':1,'result':{'testUnchanged':True},'n':128}
results=[]
for name in ['complete','drift','missing-first','single-final-wrong-size','wrong-size','reordered','duplicate','nonfinite','reused-worker','wrong-case-order']:
 e=copy.deepcopy({k:v for k,v in base.items() if k!='math'});e['math']=math
 if name=='drift':e['result']['testUnchanged']=False
 if name=='missing-first':e['memory'].pop(0)
 if name=='single-final-wrong-size':e['memory']=[dict(sample,stage=stages[-1],size=999)]
 if name=='wrong-size':e['memory'][0]['size']=999
 if name=='reordered':e['memory'][0],e['memory'][1]=e['memory'][1],e['memory'][0]
 if name=='duplicate':e['memory'].insert(0,e['memory'][0].copy())
 if name=='nonfinite':e['memory'][0]['heapUsed']=float('nan')
 if name=='reused-worker':e['pids']={1}
 if name=='wrong-case-order':e['cases'].reverse()
 run=lambda node:eval(compile(ast.Expression(node),str(p),'eval'),e)
 e['numeric']=run(assign('numeric'));e['valid']=run(assign('valid'));stopped=bool(run(stop));assert stopped==(name!='complete'),name
 results.append({'case':name,'accepted':e['valid'],'stops':stopped})
r={'controllerSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'exactTemplateStages':True,'method':'Extract actual AST expressions; no import, process launch or measurement','cases':results,'passed':True};out=Path('/private/tmp/st-c28-r3-preparation-reader-review/MEMORY-CONTROLLER-R1-CHECK.json');out.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
