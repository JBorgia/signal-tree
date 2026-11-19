from pathlib import Path
import os,json,hashlib,difflib
p=Path('/private/tmp/st-packet-index-successor');src=Path('/private/tmp/st-native-combined-b/candidate');base=json.loads((p/'BASE-SOURCE-SHA256.json').read_text());report={}
hashfile=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
changes={k:hashfile(p/'candidate'/k)for k in base if hashfile(p/'candidate'/k)!=base[k]}
assert set(changes)=={'packages/kernel/src/lib/experimental-publication/entity.ts'},changes
assert all(hashfile(src/k)==h for k,h in base.items()),'frozen B changed'
report['baseFilesVerified']=len(base);report['runtimeChanges']=changes
runtime='packages/kernel/src/lib/experimental-publication/entity.ts'
(p/'runtime.patch').write_text(''.join(difflib.unified_diff((src/runtime).read_text().splitlines(True),(p/'candidate'/runtime).read_text().splitlines(True),fromfile='a/'+runtime,tofile='b/'+runtime)))
test='packages/kernel/src/lib/packet-index-adversarial.spec.ts'
(p/'tests.patch').write_text(''.join(difflib.unified_diff([],(p/'candidate'/test).read_text().splitlines(True),fromfile='/dev/null',tofile='b/'+test)))
manifest=dict(base);manifest.update(changes);manifest[test]=hashfile(p/'candidate'/test)
(p/'SOURCE-SHA256.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
alloc=p/'allocation-final';rows={}
for arm in ['baseline-b','optimized']:
 records=[json.loads(s)for s in (alloc/f'{arm}.jsonl').read_text().splitlines()];assert len(records)==9
 rows[arm]={(r['n'],r['mode']):r for r in records}
 for n in [32,128,1024]:
  for mode in ['bare','held','foreign']:
   r=rows[arm][n,mode];a=next(s for s in r['snapshots']if s['phase']=='populate-return')['allocation']
   total=lambda k:sum(v[k]for v in a.values())
   assert total('arrayEntries')==(4*n*n+n if arm=='baseline-b' else 10*n+2)
   assert total('containers')==5*n+(20 if arm=='baseline-b' else 22)
   if arm=='optimized':assert 'proposal-copy' not in a and a['ordinary-flatMap']['arrays']==1
 (alloc/f'{arm}-instrumentation.patch').write_text('')
 for rel in ['packages/kernel/src/lib/experimental-publication/entity.ts','packages/kernel/src/lib/internals/entity-publication.ts']:
  original=(src if arm=='baseline-b'else p/'candidate')/rel;changed=alloc/arm/rel
  patch=''.join(difflib.unified_diff(original.read_text().splitlines(True),changed.read_text().splitlines(True),fromfile=str(original),tofile=str(changed)))
  with (alloc/f'{arm}-instrumentation.patch').open('a') as f:f.write(patch)
 report[arm]={'allocationSpecSHA256':hashfile(alloc/arm/'packages/kernel/src/lib/allocation-diagnostic.spec.ts'),'instrumentedEntitySHA256':hashfile(alloc/arm/runtime),'jsonlSHA256':hashfile(alloc/f'{arm}.jsonl'),'logSHA256':hashfile(alloc/f'{arm}.log')}
 assert report[arm]['allocationSpecSHA256']==hashfile(Path('/private/tmp/st-publication-allocation-discriminator/allocation.spec.ts'))
for key,a in rows['baseline-b'].items():
 b=rows['optimized'][key]
 assert [(s['phase'],s['retained'])for s in a['snapshots']]==[(s['phase'],s['retained'])for s in b['snapshots']],key
report['retainedSnapshots']='identical at every phase for all nine matched records'
report['artifacts']={name:hashfile(p/name)for name in ['runtime.patch','tests.patch','SOURCE-SHA256.json','BASE-SOURCE-SHA256.json']}
(p/'VERIFICATION.json').write_text(json.dumps(report,indent=2)+'\n')
print('Frozen B unchanged; one runtime file; exact allocation spec replay; all retention checkpoints identical; allocation formulas verified.')
