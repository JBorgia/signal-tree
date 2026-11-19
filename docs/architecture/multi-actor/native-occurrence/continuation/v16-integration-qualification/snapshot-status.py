from pathlib import Path
import json,datetime
p=Path(__file__).resolve().parent;s=json.loads((p/'IDENTITY.json').read_text());runs={}
for d in sorted((p/'runs').iterdir()):
 if not d.is_dir():continue
 r=d/'RESULT.json';v=json.loads(r.read_text()) if r.exists() else {'state':'running or awaiting receipt'}
 for file,key in [('PROCESS.json','process'),('COMMAND.json','command')]:
  f=d/file
  if f.exists():v[key]=json.loads(f.read_text())
 runs[d.name]=v
s.update({'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':runs,'heavySlot':'owned by this worker; sequential only','rootDocs':'Main-owned; untouched','largeMemory':'not authorized/run','pending':['remaining artifact qualification and final preservation report']})
(p/'STATUS.json').write_text(json.dumps(s,indent=2)+'\n');print({k:v.get('exit',v.get('state')) for k,v in runs.items()})
