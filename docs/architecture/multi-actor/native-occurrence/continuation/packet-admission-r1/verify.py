from pathlib import Path
import json,hashlib,difflib
p=Path('/private/tmp/st-packet-index-admission-r1');src=Path('/private/tmp/st-packet-index-successor/candidate');base=json.loads((p/'BASE-SOURCE-SHA256.json').read_text());h=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
assert all(h(src/k)==v for k,v in base.items()),'frozen predecessor changed'
changes={k:h(p/'candidate'/k)for k,v in base.items()if h(p/'candidate'/k)!=v}
assert set(changes)=={'packages/kernel/src/lib/experimental-publication/entity.ts','packages/kernel/src/lib/internals/entity-publication.ts'}
new=['packages/kernel/src/lib/packet-admission-r1.spec.ts','packages/kernel/src/lib/packet-index-review.spec.ts']
manifest=dict(base);manifest.update(changes);manifest.update({k:h(p/'candidate'/k)for k in new})
(p/'SOURCE-SHA256.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
(p/'runtime.patch').write_text(''.join(''.join(difflib.unified_diff((src/k).read_text().splitlines(True),(p/'candidate'/k).read_text().splitlines(True),fromfile='a/'+k,tofile='b/'+k))for k in changes))
(p/'tests.patch').write_text(''.join(''.join(difflib.unified_diff([],(p/'candidate'/k).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+k))for k in new))
assert h(p/'candidate'/new[1])==h(p/'first-failures/packet-index-review.spec.ts')
a=p/'allocation-final';records={arm:[json.loads(l)for l in (a/(arm+'.jsonl')).read_text().splitlines()]for arm in ['baseline-b','optimized']}
assert all(len(v)==9 for v in records.values())
for r in records['optimized']:
 b=next(x for x in records['baseline-b']if (x['n'],x['mode'])==(r['n'],r['mode']))
 assert [(x['phase'],x['retained'])for x in r['snapshots']]==[(x['phase'],x['retained'])for x in b['snapshots']]
rows=[]
for n in [32,128,1024]:
 row={'n':n}
 for arm in records:
  r=next(x for x in records[arm]if x['n']==n and x['mode']=='bare');d=next(x['allocation']for x in r['snapshots']if x['phase']=='populate-return')
  # Distinguish native Map constructors from newly instrumented metadata shells.
  row[arm]={'arrayEntries':sum(v['arrayEntries']for v in d.values()),'nativeMaps':sum(v['containers']for k,v in d.items()if k.startswith('entity.ts:')),'nativeMapSets':sum(v['sets']for k,v in d.items()if k.startswith('entity.ts:')),'ownershipShells':sum(v['containers']for k,v in d.items()if k.startswith('ownership-shell:')),'sealing':d.get('ownership-sealing'),'sites':d}
  assert row[arm]['arrayEntries']==(4*n*n+n if arm=='baseline-b'else 2*n)
 rows.append(row)
point=[json.loads(l)for l in (a/'point.jsonl').read_text().splitlines()];assert len(point)==2 and point[0]['allocation']==point[1]['allocation']
instrumented={}
for arm,source in [('baseline-b',Path('/private/tmp/st-native-combined-b/candidate')),('optimized',p/'candidate')]:
 assert h(a/arm/'packages/kernel/src/lib/allocation-diagnostic.spec.ts')==h(Path('/private/tmp/st-publication-allocation-discriminator/allocation.spec.ts'))
 paths=list(changes)
 (a/(arm+'-instrumentation.patch')).write_text(''.join(''.join(difflib.unified_diff((source/k).read_text().splitlines(True),(a/arm/k).read_text().splitlines(True),fromfile=str(source/k),tofile=str(a/arm/k)))for k in paths))
 instrumented[arm]={k:h(a/arm/k)for k in paths+['packages/kernel/src/lib/allocation-diagnostic.ts','packages/kernel/src/lib/allocation-diagnostic.spec.ts']}
(a/'FINAL-IDENTITY.json').write_text(json.dumps(instrumented,indent=2)+'\n')
(p/'COUNTS.json').write_text(json.dumps({'batch':rows,'point':point},indent=2)+'\n')
(p/'VERIFICATION.json').write_text(json.dumps({'predecessorVerifiedFiles':len(base),'changedRuntime':changes,'newTests':new,'retention':'all nine matched records and every checkpoint identical','pointConstruction':'identical at 2000 and 20000 rows','instrumented':instrumented,'artifacts':{k:h(p/k)for k in ['SOURCE-SHA256.json','runtime.patch','tests.patch','COUNTS.json']}},indent=2)+'\n')
print('Verified predecessor, two runtime files, original tests unchanged, retention checkpoints and final instrumented identities.')
