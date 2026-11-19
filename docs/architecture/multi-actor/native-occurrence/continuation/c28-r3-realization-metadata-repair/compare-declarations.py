from pathlib import Path
import hashlib,json,re
root=Path(__file__).parent
roots={arm:root/'gate-declarations'/arm/'packages/kernel/src' for arm in ['baseline','candidate']}
entries=['index.d.ts','adapter.d.ts','internals.d.ts'];result={}
def walk(base):
 seen=set();todo=list(entries);missing=[]
 while todo:
  rel=todo.pop()
  if rel in seen:continue
  seen.add(rel);f=base/rel
  if not f.exists():missing.append(rel);continue
  for ref in re.findall(r'''(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]''',f.read_text()):
   if not ref.startswith('.'):continue
   full=(f.parent/ref).resolve(); options=[Path(str(full)+'.d.ts'),full/'index.d.ts']
   target=next((x for x in options if x.exists()),None)
   if target is None:missing.append(str(full));continue
   if target.is_relative_to(base.resolve()):todo.append(str(target.relative_to(base.resolve())))
 return seen,missing
sets={}
for arm,base in roots.items():
 seen,missing=walk(base);sets[arm]=seen
 result[arm]={'closureFiles':len(seen),'missing':missing,'hashes':{rel:hashlib.sha256((base/rel).read_bytes()).hexdigest() for rel in sorted(seen) if (base/rel).exists()}}
result['added']=sorted(sets['candidate']-sets['baseline']);result['removed']=sorted(sets['baseline']-sets['candidate'])
result['changed']=[r for r in sorted(sets['baseline']&sets['candidate']) if (roots['baseline']/r).read_bytes()!=(roots['candidate']/r).read_bytes()]
(root/'PUBLIC-DECLARATIONS.json').write_text(json.dumps(result,indent=2)+'\n')
print({k:v for k,v in result.items() if k not in roots});print({a:(result[a]['closureFiles'],result[a]['missing']) for a in roots})
