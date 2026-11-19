from pathlib import Path
import json,collections,hashlib
r=Path('/private/tmp/st-native-broad-differential')
allrows={l:json.loads((r/(l+'-TEST-IDENTITIES.json')).read_text()) for l in ['predecessor','successor']}
key=lambda x:(x['project'],x['file'],x['fullName'],x['duplicateOrdinal'])
a,b=({key(x):x for x in allrows[l]} for l in ['predecessor','successor'])
ledger={}
for l,rows in allrows.items():
 groups=collections.defaultdict(list)
 for x in rows:groups[(x['project'],x['file'],x['fullName'])].append(x)
 ledger[l]=[{'identity':k,'assertions':v} for k,v in groups.items() if len(v)>1]
(r/'DUPLICATE-IDENTITY-LEDGER.json').write_text(json.dumps(ledger,indent=2))
sharedfail=[{'before':a[k],'after':b[k]} for k in sorted(a.keys()&b.keys()) if a[k]['status']=='failed' and b[k]['status']=='failed']
(r/'SHARED-FAILURES.json').write_text(json.dumps(sharedfail,indent=2))
byfile=collections.Counter((x['before']['project'],x['before']['file']) for x in sharedfail)
(r/'SHARED-FAILURE-GROUPS.json').write_text(json.dumps([{'project':p,'file':f,'count':n,'classification':'same failed identity, not proof of identical cause'} for (p,f),n in sorted(byfile.items())],indent=2))
expected=json.loads((r/'EXPLICIT-EXPECTED-FAILURE-TESTS.json').read_text())
(r/'EXPECTED-FAILURE-ACTUAL-STATUS.json').write_text(json.dumps({l:[{'declaration':e,'actual':[x for x in allrows[l] if x['file']==e['file'] and x['fullName'].endswith(e['title'])]} for e in expected[l]] for l in expected},indent=2))
(r/'UNEXECUTED-ASSERTIONS.json').write_text(json.dumps({l:[x for x in rows if x['status']=='pending'] for l,rows in allrows.items()},indent=2))
# Recheck exact originals/copies after isolated replays, without modifying sources.
for l,orig in [('predecessor','/private/tmp/st-native-explicit-handoff-successor/candidate'),('successor','/private/tmp/st-prepared-paired-successor/candidate')]:
 m=json.loads((r/l/'SOURCE-SHA256.json').read_text())
 for base in [Path(orig),r/l/'candidate']:
  for n,h in m.items():assert hashlib.sha256((base/n).read_bytes()).hexdigest()==h,(base,n)
(r/'POST-REPLAY-SOURCE-UNCHANGED.json').write_text(json.dumps({'originals':True,'copies':True,'checked':'all manifest entries after focused replays'},indent=2))
print('shared failed identities',len(sharedfail));print('duplicates', {l:sum(len(x['assertions'])-1 for x in v) for l,v in ledger.items()})
