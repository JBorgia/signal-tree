from pathlib import Path
import json,datetime
p=Path(__file__).resolve().parent;results={}
for d in sorted((p/'runs').iterdir()):
 if not d.is_dir():continue
 f=d/'RESULT.json'
 if f.exists():
  r=json.loads(f.read_text());results[d.name]={k:r[k] for k in ['exit','qualified','classification','workerPids','remainingOwned','sourceMismatches','maxObservedOwnedRssBytes','minimumObservedHostFreePercentage']}
 else:results[d.name]={'state':'in progress; see PROCESS.json and first.log'}
s={'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'identity':json.loads((p/'IDENTITY.json').read_text()),'results':results,'stopped':(p/'STOP.json').exists(),'heavySlot':'retained exclusively','scope':'finite selected-case functional qualification; not A/B memory measurement'};(p/'STATUS.json').write_text(json.dumps(s,indent=2)+'\n');print(json.dumps(results))
