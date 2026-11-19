from pathlib import Path
import json,hashlib,shutil
out=Path('/private/tmp/st-footprint-discriminator-a');source=Path('/private/tmp/st-occurrence-successor');copy=out/'candidate';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=json.loads((out/'FROZEN-SOURCE-SHA256.json').read_text())
for name,digest in manifest.items():
 assert sha(source/name)==digest,name
 assert sha(copy/name)==digest,name
rows=[json.loads(x) for x in (out/'observations.jsonl').read_text().splitlines()];assert len(rows)==12
first=[json.loads(x) for x in (out/'001-observations.jsonl').read_text().splitlines()]
for row in rows:
 assert row['before']==row['afterEqual']['q']
 assert row['afterReject'].get('rejectionError') is None
 assert row['afterReject']['value']==(0 if row['ownership']=='same' else 7)
 assert row['afterEqual']['sent']==([{'other':1}] if row['route']=='restore' else [])
 peer=next(r for r in rows if r['ownership']==row['ownership'] and r['route']==row['route'] and r['observe']!=row['observe'])
 for key in ['before','afterEqual','afterReject']:assert row[key]==peer[key],(row['ownership'],row['route'],key)
 before=next(r for r in first if all(r[k]==row[k] for k in ['ownership','route','observe']))
 assert row==before,('cleanup changed observations',row['ownership'],row['route'])
fixture=copy/'packages/kernel/src/lib/footprint-discriminator-a.spec.ts';shutil.copy(fixture,out/'final-fixture.spec.ts')
(out/'VERIFICATION.json').write_text(json.dumps({'frozenSourceFilesVerified':len(manifest),'copiedSourceFilesVerified':len(manifest),'cases':12,'observedAndUnobservedMatch':True,'sameTreeRollbackRestoresZero':True,'foreignRollbackRetainsSeven':True,'qInspectionUnchangedByEqualWrite':True,'noPreSettlementSevenDelivery':True,'firstAndCleanupCorrectedObservationsMatch':True,'fixtureSha256':sha(fixture),'sourceManifestSha256':sha(out/'FROZEN-SOURCE-SHA256.json')},indent=2)+'\n')
files={str(p.relative_to(out)):sha(p) for p in sorted(out.rglob('*')) if p.is_file() and not p.is_symlink() and str(p.relative_to(out)).split('/')[0]!='candidate' and p.name!='EVIDENCE-SHA256.json'}
(out/'EVIDENCE-SHA256.json').write_text(json.dumps(files,sort_keys=True,indent=2)+'\n')
print('Verified original/copied source and all 12 observations. Evidence manifest:',sha(out/'EVIDENCE-SHA256.json'))
