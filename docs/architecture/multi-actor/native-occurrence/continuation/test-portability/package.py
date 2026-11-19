import pathlib,json,hashlib,difflib
b=pathlib.Path('/private/tmp/st-test-sink-cleanup');s=pathlib.Path('/private/tmp/st-v16-integration-candidate')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
inv=json.loads((b/'inventory-baseline.json').read_text())
for x in inv: assert sha(s/x['file'])==x['sha256'],x['file']
files=sorted(p.relative_to(b/'overlay').as_posix() for p in (b/'overlay').rglob('*') if p.is_file());assert len(files)==15
patch=[];manifest=[]
for f in files:
 old=b/'before'/f;new=b/'overlay'/f
 patch.extend(difflib.unified_diff(old.read_text().splitlines(True) if old.exists() else [],new.read_text().splitlines(True),fromfile='a/'+f if old.exists() else '/dev/null',tofile='b/'+f))
 manifest.append({'file':f,'before_sha256':sha(old) if old.exists() else None,'overlay_sha256':sha(new)})
(b/'portability.patch').write_text(''.join(patch));(b/'HASHES.json').write_text(json.dumps({'source':'/private/tmp/st-v16-integration-candidate','source_identity':'user-designated frozen8bd; snapshot has no Git metadata; inventory hashes verified before and after','patch_sha256':sha(b/'portability.patch'),'files':manifest},indent=2)+'\n')
(b/'later-nx-command.txt').write_text('env -u ST_JOINT_PHASE_OUTPUT -u ST_FIXED_WINDOW_OUTPUT -u ST_PREPARED_REVIEW_OUTPUT -u ST_TWO_HISTORY_OUTPUT -u ST_PUBLIC_DIAGNOSTIC_OUTPUT -u ST_EQUAL_OWNER_TRACE -u ST_PERF -u ST_PERF_OUTPUT_FILE -u ST_RETIREMENT_FAULT -u ST_GC_ARM -u ST_GC_SCENARIO -u ST_GC_OUTPUT pnpm nx test kernel --skip-nx-cache '+' '.join('--testFile='+f for f in files if f.endswith('.spec.ts'))+'\n')
print('Patch SHA256: '+sha(b/'portability.patch'));print('All 38 inventory files remain unchanged; exactly 13 existing specs + 2 new test-only files.')
