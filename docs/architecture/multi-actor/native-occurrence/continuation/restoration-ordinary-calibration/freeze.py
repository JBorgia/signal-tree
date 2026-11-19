from pathlib import Path
import json,hashlib,re,subprocess
p=Path(__file__).resolve().parent;c=p/'candidate';base=json.loads((p/'BASE-MANIFEST.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
manifest={f:sha((c/f).read_bytes()) for f in base};changed=[f for f in base if base[f]!=manifest[f]]
expected=['packages/kernel/src/lib/restoration-paired-work.spec.ts','packages/kernel/src/enhancers/restoration/large-batch-restoration-v16-controls.spec.ts'];assert set(changed)==set(expected)
assert not list((c/'packages/kernel/src/lib').glob('restoration-calibrated-*.spec.ts'))
for f in expected:assert sha((p/'originals'/Path(f).name).read_bytes())==base[f]
# Replaying only the review patch must reproduce both frozen files.
d=p/'patch-check';d.mkdir()
for f in expected:
 out=d/f;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes((p/'originals'/Path(f).name).read_bytes())
r=subprocess.run(['git','apply',str(p/'calibration.patch')],cwd=d,capture_output=True,text=True);assert r.returncode==0,r.stderr
assert all((d/f).read_bytes()==(c/f).read_bytes() for f in expected)
results={}
for arm in ['baseline','source-types','spec-types','mutant-validation','mutant-snapshot']:
 root=p/'runs'/arm;result=json.loads((root/'RESULT.json').read_text());restore=json.loads((root/'RESTORED.json').read_text());assert restore['equal']
 assert result['exit']==(1 if arm.startswith('mutant') else 0)
 log=(root/'first.log').read_text();errors=[line for line in log.splitlines() if line.startswith('AssertionError:')]
 if arm.startswith('mutant'):assert len(errors)==3;assert all('less than or equal to' in e for e in errors)
 results[arm]={'result':result,'restore':restore,'assertionErrors':errors,'testCounts':[line for line in log.splitlines() if 'Test Files ' in line or 'Tests ' in line]}
(p/'RESULTS.json').write_text(json.dumps(results,indent=2)+'\n')
(p/'SNAPSHOT-CANDIDATE.json').write_text(json.dumps(manifest,indent=2)+'\n')
(p/'FREEZE.json').write_text(json.dumps({'baselineManifestSha256':'73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27','candidateManifestSha256':sha((p/'SNAPSHOT-CANDIDATE.json').read_bytes()),'patchSha256':sha((p/'calibration.patch').read_bytes()),'changed':changed,'runtimeUnchanged':True,'diagnosticsPromoted':False,'originalsPreserved':True,'130kExecuted':False,'patchReplayMatches':True},indent=2)+'\n')
(p/'REPORT.md').write_text('''# Ordinary restoration calibration — bounded successor

Ready for independent review. Final patch touches only the two original ordinary specs. Runtime/config/tooling and all other C21 inputs are unchanged. No diagnostic files are added and no output environment is required.

The patch preserves 3N/12N row ceilings and explicitly names separate costs: TEMPORAL_MANAGER_READS=1 for redo leaving the temporal view; READER_LIFECYCLE_READS=1 per operation when a restoration reader has been acquired. Paired undo remains 3N, paired redo is 12N+1. Reader-acquired undo is 3N+1, redo 12N+2. Comments explain the actual currentIndex and destroyed-state reads. All other assertions, sizes, imports, operations, resets and teardown remain intact, including the second large claim-release case. No artifact budget or point-work limit changed.

The original two files and original first failures are archived under originals/ and ORIGINAL-FAILURE-STACKS.txt. Earlier diagnostics and their first type failures remain in their frozen research packets; they are not reused or promoted. No mode-typing change was needed in this successor.

## Executed qualification

- Ordinary restoration-paired-work.spec.ts, original N3/32/256 cases: **3/3 pass**, no ST_TRACE_OUTPUT or ST_PREPARED_REVIEW_OUTPUT.
- Source types: **pass**, generated proof check and both source projects via pnpm run typecheck.
- Spec types: **pass**, unchanged tools/check-spec-types.mjs and ratchet.
- Actual repeated-validation mutant: **3/3 killed**, at the original ordinary undo dependency ceiling; observed reads18/192/1536 versus allowed9/96/768.
- Actual repeated-row-snapshot mutant: **3/3 killed**, at the calibrated ordinary redo dependency ceiling; observed reads61/641/5121 versus allowed37/385/3073.

Mutants are separate temporary changes to the already-reviewed reached runtime sites, never combined or shipped. Validation repeats canApplyEffect in buildPreparedRealizationContext; snapshot repeats rowNode() in snapshotCollectionEntityValue. Neither touches counters. Per-arm patches, commands, first logs and runtime before/during/restore hashes are preserved. Both restore exactly fd5795420a9ecb633b2269e3000aba192bf6c9ef90452bf4a63c0f5fbb862b50. No startup/type/semantic failure is being mislabeled as a work kill: each mutant reaches the ordinary numeric assertion and logs its expected additional work.

Ordinary hard assertions stop after the failing count; later assertions in those mutant executions are not claimed passed. In the snapshot mutant, undo row verification and redo tombstone verification are reached first; in validation, writes=N is reached first. Baseline completes every paired assertion. The previous research experiment's complete semantic/parity checks under mutants remain separate supporting evidence, not newly executed ordinary results.

## Unexecuted and review boundaries

Neither130k case ran. The large ordinary file was source/spec-type checked only. Reader-acquired constants rely on the independently reviewed N3/32/256 traces and source attribution; source/scaled extrapolation gives390001 undo and1560002 redo at130k, not a fresh pass. No argument-limit, truncated-turn, full-kernel, timing or release claim. Main must select any later isolated large execution.

Exact replayable calibration.patch and SNAPSHOT-CANDIDATE.json/ FREEZE.json identify the candidate. RESULTS.json and runs/* contain actual child exits (not just Python wrapper success). Final input hash comparison permits exactly the two test changes and verifies restored runtime. Independent review before composition; retain archived first bodies/failures in the durable evidence record. Private-counter optimization remains parked until kernel qualification.
''')
files=['REPORT.md','FREEZE.json','RESULTS.json','EXPECTATIONS.md','BASE-MANIFEST.json','SNAPSHOT-CANDIDATE.json','calibration.patch','ORIGINAL-FAILURE-STACKS.txt','run.py','freeze.py']+[str(f.relative_to(p)) for f in sorted((p/'originals').glob('*'))]
for arm in results:files += [f'runs/{arm}/{name}' for name in ['COMMAND.json','RESULT.json','RESTORED.json','first.log','mutant.patch']]
(p/'SNAPSHOT.json').write_text(json.dumps({f:sha((p/f).read_bytes()) for f in sorted(files)},indent=2)+'\n')
print((p/'FREEZE.json').read_text());print('Evidence manifest SHA256',sha((p/'SNAPSHOT.json').read_bytes()))
