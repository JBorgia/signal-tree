from pathlib import Path
import json,hashlib
p=Path(__file__).resolve().parent;cmds=json.loads((p/'COMMANDS.json').read_text());m=json.loads((p/'CANDIDATE-MANIFEST.json').read_text());out={'candidateManifest':hashlib.sha256((p/'CANDIDATE-MANIFEST.json').read_bytes()).hexdigest(),'smallPartition':{'file':'packages/kernel/src/lib/entity-large-batches.spec.ts','pattern':'^setAll removal neighbour search work','selectedPassed':9,'receipt':'/private/tmp/st-v16-integration-evidence/runs/i4-neighbour-search/RESULT.json','doNotRepeatForI7':True},'largePartition':[]}
for case in cmds:
 if case['arm']!='original':continue
 label=case['id'].removeprefix('original-');r=p/'runs'/case['id']/'RESULT.json';screen=p/'runs'/('screen-'+label)/'RESULT.json';result=json.loads(r.read_text()) if r.exists() else None
 out['largePartition'].append({'file':case['file'],'sourceSha256':m[case['file']],'name':case['expectedName'],'screen2048':json.loads(screen.read_text())['classification'] if screen.exists() else 'not run','original130000':result['classification'] if result else 'not run','originalSelectedPass':bool(result and result['qualified']),'originalReceipt':str(r) if r.exists() else None,'doNotRepeatForI7':bool(result and result['qualified'])})
(p/'I7-PARTITION.json').write_text(json.dumps(out,indent=2)+'\n')
