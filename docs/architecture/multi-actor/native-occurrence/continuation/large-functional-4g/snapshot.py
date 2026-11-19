from pathlib import Path
import json,datetime,hashlib
p=Path(__file__).resolve().parent;results={}
for d in sorted((p/'runs').iterdir()):
 if not d.is_dir():continue
 f=d/'RESULT.json'
 if f.exists():
  r=json.loads(f.read_text());results[d.name]={k:r[k] for k in ['exit','qualified','classification','workerPids','remainingOwned','sourceMismatches','maxObservedOwnedRssBytes','minimumObservedHostFreePercentage']}
 else:
  results[d.name]={'state':'in progress'}
  f=d/'telemetry.jsonl'
  if f.exists():
   r=json.loads(f.read_text().splitlines()[-1]);results[d.name]['latest']={k:r[k] for k in ['at','elapsedSeconds','ownedRssBytes','hostFreePercentage','censusLatencySeconds','hostTelemetryLatencySeconds']}
s={'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidate':'/private/tmp/st-v16-integration-candidate','manifest':hashlib.sha256((p/'CANDIDATE-MANIFEST.json').read_bytes()).hexdigest(),'results':results,'stopped':(p/'STOP.json').exists(),'heavySlot':'retained exclusively','scope':'remaining3 original functional cases under newly authorized operational envelope; no cost claim'};(p/'STATUS.json').write_text(json.dumps(s,indent=2)+'\n');print(json.dumps(results))
