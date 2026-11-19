from pathlib import Path
import json,hashlib,difflib,re
r=Path(__file__).parent;s=Path('/private/tmp/st-placement-sharing-successor');initial=Path('/private/tmp/st-placement-work-successor');b=Path('/private/tmp/st-native-combined-b/candidate')
h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
for variant in ['baseline','initial','sharing']:
 for line in (r/variant/('runs/counted-with-freeze-checks/observations/counts.jsonl' if variant=='sharing' else 'runs/counted/observations/counts.jsonl')).read_text().splitlines():
  v=json.loads(line);t={}
  for scope,counts in v['counts'].items():
   for k,n in counts.items():t[k]=t.get(k,0)+n
  rows.append({'variant':variant,'operation':v['operation'],'N':v['size'],'rowClones':t.get('rowClones',0),'tuples':t.get('mapEntryTuples',0)+t.get('explicitTuples',0),'arraysExcludingTuples':t.get('arrays',0),'maps':t.get('maps',0),'pairIntervalContinuityObjects':sum(t.get(k,0) for k in ['pairRecords','intervalRecords','continuityRecords']),'visits':sum(t.get(k,0) for k in ['mapVisits','arrayVisits','constructorVisits','flattenVisits']),'freezes':t.get('freezes',0),'frozenChecks':t.get('frozenChecks',0)})
(r/'COUNTS.json').write_text(json.dumps(rows,indent=2)+'\n')
original=json.loads((initial/'SOURCE-SHA256.json').read_text());manifest={}
for p in (s/'candidate').rglob('*'):
 rel=p.relative_to(s/'candidate')
 if any(x in ['node_modules','.nx','.git','dist','coverage'] for x in rel.parts) or not p.is_file():continue
 manifest[str(rel)]=h(p)
(s/'SOURCE-SHA256.json').write_text(json.dumps(dict(sorted(manifest.items())),indent=2)+'\n')
for label,base in [('from-initial',initial/'candidate'),('from-B',b)]:
 runtime='';tests=''
 for k,v in sorted(manifest.items()):
  p=base/k
  if p.is_file() and h(p)==v:continue
  diff=''.join(difflib.unified_diff(p.read_text().splitlines(keepends=True) if p.is_file() else [],(s/'candidate'/k).read_text().splitlines(keepends=True),fromfile='a/'+k if p.is_file() else '/dev/null',tofile='b/'+k))
  if '.spec.' in k: tests+=diff
  else:runtime+=diff
 (s/f'{label}.runtime.patch').write_text(runtime);(s/f'{label}.tests.patch').write_text(tests)
def diagnostics(p):return [re.sub(r'/private/tmp/[^\s\x27]+/candidate/', '<candidate>/',x) for x in p.read_text().splitlines() if 'error TS' in x]
ver={'original52VariantMismatches':[k for k,v in original.items() if h(initial/'candidate'/k)!=v],'specDiagnostics':len(diagnostics(s/'runs/spec-types/first.log')),'specMatchOriginal':diagnostics(s/'runs/spec-types/first.log')==diagnostics(initial/'runs/final-spec-types/first.log')}
(s/'VERIFICATION.json').write_text(json.dumps(ver,indent=2)+'\n')
f={'manifestSha256':h(s/'SOURCE-SHA256.json'),'fromInitialPatchSha256':h(s/'from-initial.runtime.patch'),'fromBPatchSha256':h(s/'from-B.runtime.patch'),'status':'frozen for independent review, not activation'}
(s/'FREEZE.json').write_text(json.dumps(f,indent=2)+'\n')
print(json.dumps(f));print(json.dumps(ver))
for row in rows:print(row)
# Capture diagnostic-only source deltas so instrumentation is auditable.
for label,base in [('baseline',b),('initial',initial/'candidate'),('sharing',s/'candidate')]:
 patch=''
 for p in (r/label/'candidate/packages/kernel/src/lib').rglob('*.ts'):
  rel=p.relative_to(r/label/'candidate');old=base/rel
  if old.is_file() and h(old)==h(p):continue
  patch+=''.join(difflib.unified_diff(old.read_text().splitlines(keepends=True) if old.is_file() else [],p.read_text().splitlines(keepends=True),fromfile='a/'+str(rel) if old.is_file() else '/dev/null',tofile='b/'+str(rel)))
 (r/label/'instrumentation.patch').write_text(patch)
