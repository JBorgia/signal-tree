from pathlib import Path
import json,hashlib,shutil
out=Path('/private/tmp/st-native-equal-inverse-discriminators');base=Path('/private/tmp/st-occurrence-successor');copy=out/'candidate';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((out/'FROZEN-SOURCE-SHA256.json').read_text())
for n,h in m.items():assert sha(base/n)==h and sha(copy/n)==h,n
rows=[json.loads(x) for x in (out/'observations.jsonl').read_text().splitlines()];assert len(rows)==16
for row in rows:
 peer=next(r for r in rows if r['mode']==row['mode'] and r['route']==row['route'] and r['observe']!=row['observe']);assert row['stages']==peer['stages']
 stages={s['phase']:s for s in row['stages']};assert all(s['error'] is None for s in row['stages']);assert stages['reject-q']['value']==0
 for s in row['stages']:assert s['proof']['ordinary']==s['proof']['physical']
 if row['mode']=='independent-equal':
  s=stages['write'];assert s['proof']['ordinary']['destination']==[] and len(s['sent'])==1 and s['value']==7
  assert s['q']==stages['q']['q']
 else:
  s=stages['reject-r'];assert s['value']==7
  assert s['proof']['ordinary']['destination']==[{'name':'r','outcome':'rolled-back'}]
  assert s['q']['changes'][0]['status']=='current'
  if row['mode']!='r-changed':assert stages['write']['r']['changes']==[]
  else:assert stages['write']['value']==11 and stages['write']['q']['changes'][0]['status']=='superseded'
shutil.copy(copy/'packages/kernel/src/lib/native-equal-inverse-diagnostic.spec.ts',out/'fixture.spec.ts')
(out/'VERIFICATION.json').write_text(json.dumps({'originalAndCopiedManifestFilesVerified':len(m),'cases':16,'observerPairsMatch':True,'ordinaryPhysicalFieldProofsMatch':True,'independentEqualPrematureSevenDelivery':True,'nativeQRejectRestoresZero':True,'equalRHasNoNativeFieldChanges':True,'restoredSevenStillNamesRejectedR':True,'sourceManifestSha256':sha(out/'FROZEN-SOURCE-SHA256.json'),'fixtureSha256':sha(out/'fixture.spec.ts')},indent=2)+'\n')
print('Verified source and all 16 observations.')
