"""Publish verified local evidence into the owned study worktree; no Git mutation."""
from pathlib import Path
import hashlib,json,shutil,sys
R=Path('/Users/jonathanborgia/code/signaltree');S=R/'.worktrees/agent-collaboration-evaluation';C=R/'artifacts/optimization-sweep-final-packaging-1';E=R/'artifacts/optimization-sweep-2026-11-17'
P=Path(sys.argv[1]).resolve();D=S/'docs/audits/2026-11-17-optimization-sweep';V=D/'evidence-verification';V.mkdir()
read=lambda p:json.loads(Path(p).read_bytes())
def sha(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        while b:=f.read(1024*1024):h.update(b)
    return h.hexdigest()
def save(p,x):
    with Path(p).open('x') as f:json.dump(x,f,indent=2);f.write('\n')
def copy(src,dst):
    assert Path(src).is_file() and not Path(dst).exists();shutil.copyfile(src,dst);assert sha(src)==sha(dst)
def replace(p,a,b):
    text=p.read_text();assert text.count(a)==1,(p,a);p.write_text(text.replace(a,b))
r=read(P/'result.json');assert r['passed'] and r['reassembledBytesIdentical']
assert len(r['checks'])==7 and all(x['exitCode']==(1 if x['name'].startswith('reject-') else 0) for x in r['checks'])
for part in r['archive']['partsInOrder']:
    src=P/'parts'/part['file'];assert sha(src)==part['sha256'] and src.stat().st_size==part['bytes'];copy(src,D/part['file'])
copy(P/'result.json',V/'result.json')
for item in r['checks']:
    src=Path(item['receipt']).parent;assert sha(src/'receipt.json')==item['receiptSha256'];dst=V/item['name'];dst.mkdir()
    for name in ['plan.json','command.log','receipt.json']:copy(src/name,dst/name)
for name,src in [('archive-selection.py',S/'tools/optimization-sweep/archive-selection.py'),('archive-evidence.py',S/'tools/application-lab/archive-evidence.py'),('original-free.py',C/'original-free-source11/original-free.py'),('finish-archive.py',C/'finish-archive-source11.py'),('finalize-study.py',Path(__file__)),('prepare-report.json',Path(r['closure']['path']).parent/'report.json'),('runtime-remote-heads.json',C/'remote-heads-verified.json')]:copy(src,V/name)
assert read(V/'prepare-report.json')['complete']
summaries=[]
for name,src in [('application-summary.json',E/'t-application-final-run-1/analysis/summary.json'),('native-summary.json',E/'t-native-final-run-1/analysis/summary.json'),('capture-analysis.json',E/'t-n100-final-run-1/analysis.json'),('runtime-disposition.json',E/'final-runtime-disposition-1.json')]:
    copy(src,D/name);summaries.append({'file':name,'sha256':sha(D/name)})
attempts=[]
for i in range(1,7):
    src=C/f'prepare-command-{i}';report=R/f'artifacts/optimization-sweep-closure-final-{i}/report.json'
    if not src.exists():continue
    dst=V/f'prepare-{i}';dst.mkdir()
    for name in ['plan.json','command.log','receipt.json']:copy(src/name,dst/name)
    if report.is_file():copy(report,dst/'report.json')
    attempts.append({'receipt':str((dst/'receipt.json').relative_to(D)),'sha256':sha(dst/'receipt.json'),'exitCode':read(dst/'receipt.json')['exitCode']})
prefix='docs/audits/2026-11-17-optimization-sweep'
index={'format':'signaltree-optimization-sweep-evidence-index-v2','completedUTC':r['completedUTC'],
 'archive':{'file':'evidence.tar.gz','bytes':r['archive']['bytes'],'sha256':r['archive']['sha256'],'manifestSha256':r['archive']['manifestSha256'],'partsInOrder':r['archive']['partsInOrder'],'counts':r['counts']},
 'closure':{'sha256':r['closure']['sha256'],'format':'signaltree-optimization-closure-v2','complete':True,'report':'evidence-verification/prepare-report.json','reportSha256':sha(V/'prepare-report.json')},
 'verifiers':[{ 'file':'evidence-verification/'+name,'sha256':sha(V/name)} for name in ['archive-selection.py','archive-evidence.py','original-free.py']],
 'verification':{'passed':True,'receipt':'evidence-verification/result.json','receiptSha256':sha(V/'result.json'),'checks':[x['name'] for x in r['checks']],'reassembledBytesIdentical':True,'firstPrepareAttempts':attempts},
 'readableSummaries':summaries,
 'runtimeIdentities':{'v15':'4d1142d6166b2d5b2874715e38097665545864dc','v16':'7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830','remoteHeads':'evidence-verification/runtime-remote-heads.json','remoteHeadsSha256':sha(V/'runtime-remote-heads.json')},
 'verificationCommandsFromRepositoryRoot':[
  'ST_VERIFY_DIR="$(mktemp -d)"',
  f'cat {prefix}/evidence.tar.gz.part-* > "$ST_VERIFY_DIR/evidence.tar.gz"',
  'shasum -a 256 "$ST_VERIFY_DIR/evidence.tar.gz"',
  f'python3 {prefix}/evidence-verification/archive-evidence.py extract "$ST_VERIFY_DIR/evidence.tar.gz" "$ST_VERIFY_DIR/extracted"',
  f'python3 "$ST_VERIFY_DIR/extracted/payloads/sha256/{r["selector"]["sha256"]}" verify-extracted "$ST_VERIFY_DIR/extracted" {r["closure"]["sha256"]}',
  f'python3 -I -B {prefix}/evidence-verification/original-free.py "$ST_VERIFY_DIR/extracted" {r["closure"]["sha256"]} {prefix}/README.md'],
 'usage':'Check each ordered part hash and the aggregate archive hash against this index before extraction. Original paths are identities, not extraction destinations. The final command uses an existing file outside extraction to prove outside opens are denied, then runs the archived selector.',
 'limits':r['limits']+[
  'Source and inspection edges preserve exact input bytes without replaying historical embedded test claims. Explicit current qualification and evidence edges retain their obligations; the strongest role wins across aliases.',
  'Data-field rules bind exact document bytes, JSON pointer and value with producer/control evidence. Synthetic invalid identities and in-memory value digests are not physical file claims.',
  'The old v15 qualification summary supplies candidate archive identities only. Its already-documented missing historical logs are not recovered or passed; fresh qualification logs and exact archive joins are required.',
  'Overwritten positive synthetic fixture bytes and historical demo outputs were recovered only when their full recorded SHA-256 matched. Recovered bytes are not a rerun of old tests.',
  'Final report/index, packaging/verification receipts and final documentation gates are external to their own archive to avoid a self-hash cycle.',
  'Pinned local candidate qualification includes explicit numerical-size exceptions; no merge, tag, npm publication or deployment is selected.'],
 'finalDocumentationChecks':[]}
save(D/'EVIDENCE.json',index)
replace(D/'README.md','Evidence packaging is being closed. The v16 normal','The portable evidence archive is complete and verifies after extraction. The v16 normal')
count=r['counts'];parts=len(r['archive']['partsInOrder'])
insert=f'''The [evidence index](EVIDENCE.json) binds {count['originalVersionMappings']:,} original/version
mappings and {count['uniquePayloads']:,} unique payloads in {parts} ordered archive parts
({r['archive']['bytes']:,} compressed bytes). Reassembly is byte-identical. A fresh
extraction verifies the file-reference graph with original-file opens denied;
missing and corrupted payload controls reject, and restoration verifies.

The archive preserves source inputs as exact bytes without requalifying every
historical claim embedded in them. Consumed predecessor members remain required;
unrelated historical members do not. Exact rules distinguish deliberately invalid
test identities and in-memory value digests from files. Fresh qualification
results remain mandatory. The older v15 summary supplies archive identities;
its documented lost logs are not presented as recovered. Historical demo outputs
and overwritten positive fixtures were recovered only by full recorded hash match.

The [verification receipt](evidence-verification/result.json) records the controls
and their limits. This verifies supplied bytes and declared dependencies, not
authenticity, all Git history or universal reproducibility. Final report, index,
packaging receipts and documentation checks remain outside the archive's own
hash cycle. Readable companions are [application metrics](application-summary.json),
[native measurements](native-summary.json), [capture measurements](capture-analysis.json)
and the [runtime disposition](runtime-disposition.json).

'''
replace(D/'README.md','Commands and original data reside in the frozen evidence packet.',insert+'Commands and original data reside in the frozen evidence packet.')
replace(D/'INTEGRATION.md','independent arithmetic review are complete; evidence closure remains active. The separate','independent arithmetic review and portable evidence verification are complete. The separate')
replace(D/'INTEGRATION.md','Final artifact/archive\nverification, documentation checks and authorized branch sharing close the record;','Final artifact/archive\nverification is complete; documentation checks and authorized branch sharing close the record;')
replace(D/'CANDIDATES.md','qualification and comparison now complete. Evidence packaging closes the record.','qualification, comparison and portable evidence verification now complete.')
replace(S/'RELEASE-CURRENT.md','### November 17 broader optimization sweep — active','### November 17 broader optimization sweep — complete')
replace(S/'RELEASE-CURRENT.md','speedup or universal memory bound is claimed. Final evidence packaging,\ndocumentation reconciliation and authorized branch sharing remain active.','speedup or universal memory bound is claimed. The portable evidence archive\nverifies after extraction with original-file opens denied; corrupt/missing payload\ncontrols and ordered-part reassembly pass. Final documentation and review-branch\nsharing close this phase. The [evidence index](docs/audits/2026-11-17-optimization-sweep/EVIDENCE.json)\nrecords exact identities, checks and historical scope limits.')
replace(S/'TODO.md','## Active optimization sweep','## Completed optimization sweep')
replace(S/'TODO.md','- [ ] Combine worthwhile changes, qualify exact artifacts, rerun affected comparisons, independently review interpretation and report the results.','- [x] Combine worthwhile changes, qualify exact artifacts, rerun affected comparisons, independently review interpretation and report the results with portable verified evidence.')
print(json.dumps({'passed':True,'parts':parts,'counts':count,'index':str(D/'EVIDENCE.json')}))
