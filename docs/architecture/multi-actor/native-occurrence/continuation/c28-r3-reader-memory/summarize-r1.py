from pathlib import Path
import json,csv,hashlib
w=Path(__file__).resolve().parent;r=w/'R1';results=json.loads((r/'STATUS.json').read_text());assert isinstance(results,list)
summary=[];boundaries=[]
for item in results:
 d=r/'runs'/f"{item['arm']}-{item['size']}-r{item['replicate']}";rows=[json.loads(l) for l in (d/'memory.jsonl').read_text().splitlines()] if (d/'memory.jsonl').exists() else [];stages={v['stage']:v for v in rows}
 summary.append({**item,'boundaryCount':len(rows),'selectedBoundaryHeapUsed':{name:stages[name]['heapUsed'] for name in ['restoration:after-replace','restoration:before-undo','restoration:after-undo','restoration:after-redo','restoration:after-destroy','restoration:after-final-drain'] if name in stages}})
 for row in rows:boundaries.append({'arm':item['arm'],'replicate':item['replicate'],**row})
(r/'SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n')
if boundaries:
 with (r/'BOUNDARIES.csv').open('w') as f:
  keys=list(boundaries[0]);out=csv.DictWriter(f,fieldnames=keys);out.writeheader();out.writerows(boundaries)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();evidence={}
for p in r.rglob('*'):
 if p.is_file() and not any(k in p.relative_to(r).parts for k in ['cache','data','tmp']) and p.name!='EVIDENCE-SNAPSHOT.json':evidence[str(p.relative_to(r))]=sha(p)
(r/'EVIDENCE-SNAPSHOT.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(summary,indent=2))
