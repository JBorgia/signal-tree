from pathlib import Path
import json,hashlib,re,shutil
out=Path('/private/tmp/st-c27-remaining-failure-ledger'); root=Path('/Users/jonathanborgia/code/signaltree'); cont=root/'docs/architecture/multi-actor/native-occurrence/continuation'
base=Path('/private/tmp/st-native-combined-c21'); later=Path('/private/tmp/st-native-combined-c23'); part=Path('/private/tmp/st-c21-undispatched-kernel')
h=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
bm=json.loads((base/'SNAPSHOT-C21.json').read_text()); lm=json.loads((later/'SNAPSHOT-C23.json').read_text())
assert h(base/'SNAPSHOT-C21.json')=='73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27'
assert h(later/'SNAPSHOT-C23.json')=='bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b'
comp=later/'runs/composition'; raw=(comp/'first.log').read_text(); assert '59 passed (59)' in raw and '9 passed (9)' in raw
assert json.loads((comp/'RESULT.json').read_text())['exit']==0
rows=[]; evidence=set([base/'SNAPSHOT-C21.json',later/'SNAPSHOT-C23.json',part/'first.log',part/'FAILURE-STACKS.txt',part/'FAILURE-INDEX.txt',comp/'first.log',comp/'COMMAND.json',comp/'RESULT.json',comp/'SOURCE-BEFORE.json',comp/'SOURCE-AFTER.json',later/'run.py',later/'COMPOSITION.json'])
for i,line in enumerate((part/'FAILURE-INDEX.txt').read_text().splitlines(),1):
 path,title=line.strip().removeprefix('FAIL  ').split(' > ',1); rel='packages/kernel/'+path
 original=base/'candidate'/rel; assert h(original)==bm[rel]
 archive=out/'originals'/rel;archive.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original,archive)
 latest=rel;target=title;logs=[str(comp/'first.log')];identity=str(later/'SNAPSHOT-C23.json')
 if i==1:
  status='AUTHORIZED COUNT CALIBRATION; LARGE EXECUTION UNRESOLVED'
  reason='Original 390001 > 390000 is a real reader-lifecycle singleton, not demonstrated redundant row work. Calibrated undo 3N+1/redo 12N+2. Latest C23 stage run ended at before-undo; no undo completion, redo, cleanup assertions or measured final counts.'
  logs=[str(Path('/private/tmp/st-c23-restoration-stage-independent/run-once')/f) for f in ['first.log','stages.jsonl','WATCHDOG.json','RESULT.json']]
  target=title+' (stage-marker-only diagnostic; original assertions unchanged)'
 elif i in [2,3,4,5,11,12]:
  status='AUTHORIZED ORACLE REPLACEMENT; COUNTERPARTS PASS'
  latest='packages/kernel/src/lib/recipient-progress-positive-counterparts.spec.ts'
  if i<6:
   mode='branch' if i<4 else 'root'; enrollment='before-pending' if i in [2,4] else 'during-pending'
   target=f'aggregate exact progress {mode}/{enrollment}/confirm AND /rollback'
  else: target='domain-only root input / branch output '+('confirm' if i==11 else 'rollback')
  reason='Unrelated pending owner/recipient-only mismatch cannot manufacture native obligation. Exact both-endpoint payload, no borrowed declaration permission, unchanged ownership, settlement and no duplicates asserted. Actual-native-window counterweights and all 13 retained permission/unknown guards pass in same C23 union.'
 elif i==6:
  status='FIXED GC ROUTING; UNCHANGED BODY PASSES'
  reason='Original fails typeof globalThis.gc before capture. Same selected-write continuation/non-replay assertions pass in explicit hold-proceed/drop-proceed/hold-row arms, alongside original nine GC modes. Not a reader-freshness oracle change.'
  g=Path('/private/tmp/st-c23-gc-composition-verification/candidate/artifacts/forwarding-retention/run-08foao')
  logs=[str(g/f'held-{arm}.log') for arm in ['hold-proceed','drop-proceed','hold-row']]+[str(g/'RESULT.json')]
  target=title+' [three explicit GC arms]'
  assert json.loads((g/'RESULT.json').read_text())['matrixErrors']==[]
 elif i in range(7,11):
  status='FIXED OUTPUT HARNESS; UNCHANGED CASE PASSES'
  reason='Required ST_PUBLIC_DIAGNOSTIC_OUTPUT omitted originally. C23 runner supplies own public-observations directory; exact retry/confirm artifact exists and original atomic-refusal assertions run unchanged.'
  order='xy' if i<9 else 'yx';follow='retry' if i in [7,9] else 'confirm'; logs += [str(comp/f'public-observations/{order}-{follow}.json')]
 elif i in [13,14,15]:
  status='AUTHORIZED COUNT CALIBRATION; SCALED ORIGINAL PASSES'
  n=[3,32,256][i-13]
  reason=f'Original redo {12*n+1} > {12*n} includes one currentIndex manager read. Undo 3N unchanged; redo 12N+1, every row/write/order/tombstone assertion retained. Real repeated-validation and row-snapshot mutants reach and fail numeric ceilings.'
 elif i in [16,17]:
  status='FIXED PRIVATE-SPY FORWARDING; ORIGINAL ASSERTIONS PASS'
  reason='Spy dropped shared publicationPhase, causing sibling standalone revalidation before injected invalidation. Typed rest tuple/original.apply(this,args) preserves phase and receiver; sentinel identity, later invalidation attempts and state/delivery assertions unchanged.'
 lp=later/'candidate'/latest; assert h(lp)==lm[latest]
 if i in range(7,11) or i==6: assert bm[rel]==lm[latest]
 for log in logs: assert Path(log).exists();evidence.add(Path(log))
 evidence.add(lp)
 rows.append(dict(id=i,originalCase=title,originalTestPath=rel,originalSha256=bm[rel],preservedOriginal=str(archive),originalFailureLog=str(part/'first.log'),originalSourceManifest=str(base/'SNAPSHOT-C21.json'),classification=status,disposition=reason,latestTestPath=latest,latestTestSha256=lm[latest],latestCase=target,latestSourceManifest=identity,latestExecutedEvidence=logs))
assert len(rows)==17
# Record byte identity into the later frozen C26 prototype; this is NOT a replay.
c26=Path('/private/tmp/st-c26-scalar-finalized-role'); cm=json.loads((c26/'SNAPSHOT-C26.json').read_text())
for r in rows:
 rel=r['latestTestPath'];cp=c26/'candidate'/rel
 r['C26TestBytesUnchangedFromC23']=cp.exists() and h(cp)==r['latestTestSha256'] and cm.get(rel)==h(cp)
 r['C26ReplayClaim']=False
for p in [cont/'oracle-alignment/oracle-only.patch',cont/'reviewed-oracle-patch/TESTS.patch',Path('/private/tmp/st-restoration-ordinary-calibration/calibration.patch'),Path('/private/tmp/st-c21-fixture-corrections/injection-forwarding.patch'),Path('/private/tmp/st-c21-recipient-positive-counterparts/COUNTERPARTS.patch')]:evidence.add(p)
for name in ['mutant-validation','mutant-snapshot','baseline']:
 evidence.add(Path('/private/tmp/st-restoration-ordinary-calibration/runs')/name/'first.log')
for name in ['recipient-failure-adjudication/REVIEW.md','enrollment-independent/WINDOW-ADJUDICATION.md','restoration-ordinary-calibration/REPORT.md','c26-finite-followup/REPORT.md','c26-lifecycle-controls/REPORT.md']:
 p=cont/name
 if p.exists():evidence.add(p)
(out/'LEDGER.json').write_text(json.dumps(rows,indent=2)+'\n')
(out/'EVIDENCE-SHA256.json').write_text(json.dumps({str(p):h(p) for p in sorted(evidence)},indent=2)+'\n')
shutil.copyfile(part/'FAILURE-INDEX.txt',out/'ORIGINAL-FAILURE-INDEX.txt');shutil.copyfile(part/'FAILURE-STACKS.txt',out/'ORIGINAL-FAILURE-STACKS.txt')
lines=['# C21 original 17 failures — reconciliation through available C26 records','','Read-only reconciliation; no tests executed or source/oracle edits. **Do not carry these forward as 17 current runtime defects.** Six are authorized oracle replacements, five are harness/routing fixes, two are transparent fixture fixes, and three are executed scaled count calibrations. The remaining large restoration case has an authorized count calibration but incomplete large execution. No redundant-work defect is established by these four singleton overruns.','','Exact per-case paths, original bodies/hashes, latest source identities and raw evidence are in [LEDGER.json](LEDGER.json); all inputs used are hashed in [EVIDENCE-SHA256.json](EVIDENCE-SHA256.json). Original eight files are copied byte-for-byte under originals/, with preserved failure index/stacks. Full original log remains at '+str(part/'first.log')+'.','','## Case ledger','','Every original path below is relative to packages/kernel/. Latest executed source is C23 manifest `bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b`; original C21 is `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`. C23 raw composition command selects exactly nine files, reports all nine/59 tests passed, exit0. Thus the passing case mapping is from the selected files and their bodies, not invented per-case reporter lines.','','| # | Original case (file) | Disposition / latest evidence |','| --- | --- | --- |']
for r in rows:
 short=r['originalTestPath'].removeprefix('packages/kernel/')
 lines.append(f"| {r['id']} | {r['originalCase']} (`{short}`) | **{r['classification']}**. "+('C23 stage markers: before-undo, externally cancelled.' if r['id']==1 else 'C23 explicit GC three-arm replay.' if r['id']==6 else 'C23 nine-file composition; '+r['latestCase'])+' |')
lines += ['','## Source-supported qualifications','','- **Six recipient cases:** counterparts require exact full payload on both endpoints, actual secondary surviving admission without declaration permission, unchanged foreign owner, useful settlement and no duplicate sends. Four retained external-origin/unknown cases plus nine permission controls remain. This follows the prior enrollment-independent/WINDOW-ADJUDICATION authority, not merely observed output. Original six empty-send assertions remain archived, not silently marked passing.','- **Four public diagnostics:** exact original bytes are unchanged; run.py supplies the missing output variable and four corresponding JSON artifacts exist. COMMAND.json omits that variable from its recorded subset; runner source and produced artifacts corroborate it. No coverage inferred from output files alone: unchanged assertions plus the all-selected-files passing log supply the execution evidence.','- **Held continuation:** original failure was absent exposed GC at line27, not a stale value. Three unchanged GC arms passed in the complete C23 12-mode gate, with matrixErrors=[] and child logs. Existing routing proof/mutants are separate from this later composition replay.','- **Two heterogeneous fixtures:** inspected patch forwards exact receiver and all arguments; no assertion edit or source-validation bypass. C23 59/59 confirms the corrected fixtures on composed runtime.','- **Four counts:** real singleton reads were excluded by old row-only ceilings. Calibration keeps 3N/12N row terms and names manager/read-lifecycle constants. Baseline scaled originals pass; preserved actual-work mutants fail at 18/192/1536 versus 9/96/768, and 61/641/5121 versus 37/385/3073. These are reached assertions, not injected counter increments.','- **130k remains unresolved:** original first count 390001 was reached on C21. Later calibrated C23 uninstrumented qualification did not complete; the subsequent stage-only run reached before-undo and was cancelled after 180 seconds without progress. No after-undo, redo or cleanup assertion was reached. Source/scaled extrapolation of 390001/1560002 is not a later large-case pass, and the watchdog does not establish algorithmic cause.','','## Later-record limits','','The inspected oracle-alignment and reviewed-oracle-patch deltas target different test families; their pass/fail titles do not supersede these cases. C24–C26 equal-owner/normal-form qualification is likewise separate. A bounded search of those scratch raw logs found no later execution of these eight original files or the recipient counterpart file. LEDGER.json records whether each latest test body remains byte-identical in frozen C26; that is inheritance only, never a C26 runtime pass. No blanket current-green claim, full-kernel acceptance, restoration timing conclusion, or architecture redesign follows. Main owns repository disposition.']
(out/'REPORT.md').write_text('\n'.join(lines)+'\n')
print('17 cases, 8 originals; written report/ledger/evidence hashes. C26 byte matches:',sum(r['C26TestBytesUnchangedFromC23'] for r in rows))
