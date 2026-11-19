from pathlib import Path
import json,hashlib,difflib
p=Path('/private/tmp/st-publication-allocation-discriminator');summary={};verification={}
keys=['rows','presence','placements','viewRows','visible','placementViews','mappings','mappingViews']
for arm,original,manifest in [('row','/private/tmp/st-row-source-successor/candidate','/private/tmp/st-row-source-successor/SOURCE-SHA256.json'),('retirement','/private/tmp/st-publication-retirement-successor/candidate','/private/tmp/st-publication-retirement-successor/SOURCE-SHA256.json')]:
 records=[json.loads(x)for x in (p/f'{arm}.jsonl').read_text().splitlines()];assert len(records)==9
 summary[arm]=[]
 for r in records:
  n=r['n'];phases={x['phase']:x for x in r['snapshots']};pop=phases['populate-return']['allocation'];a=pop['proposal-copy'];b=pop['ordinary-flatMap']
  assert a['arrays']==2*n and a['arrayEntries']==2*n*n
  assert b['arrays']==2*n+1 and b['arrayEntries']==2*n*n+n
  rows=[]
  for s in r['snapshots']:
   totals={k:sum(c[k]for c in s['allocation'].values()) for k in ['containers','copiedEntries','sets','newEntries','arrays','arrayEntries']}
   rows.append({'phase':s['phase'],'totals':totals,'retained':s['retained']})
  if r['mode']!='foreign':
   final=phases['remove-complete']['retained']
   assert {k:final[k]for k in keys}==({k:0 for k in keys} if arm=='retirement' else {k:(n if k in ['presence','visible','mappings','mappingViews'] else 0)for k in keys})
  else:assert phases['foreign-useful-declared-edit']['retained']['negativePresence']==n-1
  summary[arm].append({'n':n,'mode':r['mode'],'phases':rows})
 m=json.loads(Path(manifest).read_text());sourcechanged=[];copychanged=[];checked=0
 for name,h in m.items():
  if not name.startswith('packages/kernel/src/') or name.endswith('.spec.ts'):continue
  checked+=1
  for base,changes in [(Path(original),sourcechanged),(p/arm,copychanged)]:
   f=base/name
   if not f.exists()or hashlib.sha256(f.read_bytes()).hexdigest()!=h:changes.append(name)
 verification[arm]={'manifest':manifest,'manifestSHA256':hashlib.sha256(Path(manifest).read_bytes()).hexdigest(),'checkedKernelNonSpec':checked,'originalDifferences':sourcechanged,'diagnosticDifferences':copychanged}
 assert not sourcechanged
 assert set(copychanged)=={'packages/kernel/src/lib/experimental-publication/entity.ts','packages/kernel/src/lib/internals/entity-publication.ts'}
 patch=''
 for name in copychanged:
  patch+=''.join(difflib.unified_diff((Path(original)/name).read_text().splitlines(True),(p/arm/name).read_text().splitlines(True),fromfile=str(Path(original)/name),tofile=str(p/arm/name)))
 (p/f'{arm}-instrumentation.patch').write_text(patch)
 verification[arm]['artifacts']={name:hashlib.sha256((p/name).read_bytes()).hexdigest()for name in [f'{arm}.jsonl',f'{arm}.log',f'{arm}-instrumentation.patch']}
(p/'SUMMARY.json').write_text(json.dumps(summary,indent=2)+'\n')
verification['sharedArtifacts']={name:hashlib.sha256((p/name).read_bytes()).hexdigest()for name in ['instrument.py','allocation.spec.ts','row/packages/kernel/src/lib/allocation-diagnostic.ts','retirement/packages/kernel/src/lib/allocation-diagnostic.ts']}
(p/'VERIFICATION.json').write_text(json.dumps(verification,indent=2)+'\n')
print('18 records; source identities unchanged; formulas and retention controls verified.')
