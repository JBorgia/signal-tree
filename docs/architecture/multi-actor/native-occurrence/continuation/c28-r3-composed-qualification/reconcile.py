from pathlib import Path
import json,hashlib,collections
r=Path(__file__).resolve().parent;c=r/'candidate';old=json.loads(Path('/private/tmp/st-r3-compatibility-inventory/FULL-FAILURE-LEDGER.json').read_text());manifest=json.loads((r/'BASE-MANIFEST.json').read_text());summary=json.loads((r/'FULL-SUMMARY.json').read_text());ledger=[];allcases=[]
for s in summary:
 if s['run']=='kernel':continue
 p=r/'full-runs'/s['run']/'CASE-LEDGER.json'
 for x in json.loads(p.read_text()):
  x={**x,'project':s['project'],'testPath':str(Path(x['file']).relative_to(c))};allcases.append(x)
renames={
 'React branch disposed held receipt releases waiter without settling owner':'React branch no-write receipt retains older pending work until disposal',
 'reports realization refusal with retained authority and permits confirmation':'reports injected pre-install realization refusal with retained authority and permits confirmation'
}
for x in old:
 name=renames.get(x['case'],x['case']);matches=[v for v in allcases if v['testPath']==x['testPath'] and v['name']==name];assert len(matches)<=1,(x['case'],len(matches))
 v=matches[0] if matches else None;f=Path(x['testPath']).name
 if f=='entity-granular-reactivity.spec.ts':why='Unchanged counted-work guard; no budget change or cost correction in composition.'
 elif f.startswith('whole-value-new-keys.'):why='Unchanged test. Dynamic ownership attachment now installs the shared terminal preparer for newly created ordinary leaves; selection receives actual precomputed admission.'
 elif f in ['tree-realization-adapter.spec.ts','transaction-safety.spec.ts']:why='Unchanged test. Exact-attempt realized admission keeps external B outside outer authored capture; realized notification dedup exemption preserves synchronous ABA evidence. No ambient wrapper.'
 elif f=='branch-declaration-qualification.spec.tsx':why='Reviewed receipt oracle alignment: unchanged owned equal support yields no-write receipt; exact downstream state/send/settlement and owner invariants remain. Renamed disposal case tracks older pending work; separate genuine authored held-receipt disposal case added.'
 elif f=='equal-owner-public-adversaries.spec.ts':why='Reviewed ancestor recipient-domain alignment: dependent receipt after drain conservative/unknown, final surviving basis. Exact pending hold, owner invariance, confirmation output and no duplicate retained.'
 elif f=='restoration.spec.ts':why='Private fixture reachability corrected from unused applyAtomically spy to prepareSelectedUnit spy; original public restored values/history remain.'
 else:why='Private refusal injection moved from bypassed validateEffects to actual prepareSelectedUnit before any installable plan; reached-call/no-returned-plan checks added. Generic injected refusal, not authentic public structural-drift proof. Recovery/ownership/transport obligations retained.'
 ledger.append({'project':x['project'],'testPath':x['testPath'],'originalCase':x['case'],'currentCase':name,'originalTestSha256':x['testSha256'],'currentTestSha256':manifest[x['testPath']],'testFileUnchanged':x['testSha256']==manifest[x['testPath']],'originalEvidence':x['events'],'currentState':v['state'] if v else 'not-yet-observed','currentErrors':v.get('errors',[]) if v else [],'explanation':why})
(r/'ORIGINAL26-RECONCILIATION.json').write_text(json.dumps(ledger,indent=2)+'\n')
originalKeys={(x['testPath'],renames.get(x['case'],x['case'])) for x in old}
newfail=[x for x in allcases if x['state']=='failed' and (x['testPath'],x['name']) not in originalKeys]
(r/'NEW-FAILURES.json').write_text(json.dumps(newfail,indent=2)+'\n');(r/'ALL-CASES.json').write_text(json.dumps(allcases,indent=2)+'\n')
print('original26',dict(collections.Counter(x['currentState'] for x in ledger)),'new failures',len(newfail))
for x in newfail:print(x['testPath'],x['name'],x.get('errors'))
