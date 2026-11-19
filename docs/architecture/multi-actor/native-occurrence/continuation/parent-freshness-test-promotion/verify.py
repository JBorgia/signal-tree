from pathlib import Path
import json,hashlib,subprocess
p=Path(__file__).parent;b=p.parent/'c8-proof';c=p/'candidate';m=json.loads((p/'BASE-SOURCE.json').read_text());inv=json.loads((p/'INVENTORY.json').read_text());research=set(inv['researchOnly']);normal=set(inv['promote'])
old="function save(name:string,data:unknown){writeFileSync(join(process.env.ST_PREPARED_REVIEW_OUTPUT!,name+'.json'),JSON.stringify(data,null,2));}"
new="function save(name:string,data:unknown){const out=process.env.ST_PREPARED_REVIEW_OUTPUT;if(out)writeFileSync(join(out,name+'.json'),JSON.stringify(data,null,2));}"
changed=[]
for n,h in m.items():
 assert hashlib.sha256((b/'candidate'/n).read_bytes()).hexdigest()==h,('frozen source',n)
 if n in research:
  assert not (c/n).exists();assert hashlib.sha256((p/'research-only'/n).read_bytes()).hexdigest()==h;continue
 actual=hashlib.sha256((c/n).read_bytes()).hexdigest()
 if actual!=h:
  assert n in normal and n.endswith('parent-freshness-focused.spec.ts'),n
  assert (c/n).read_text().replace(new,old)==(b/'candidate'/n).read_text();changed.append(n)
assert len(changed)==2
for n in normal:assert (c/n).read_bytes()==(p/'promote'/n).read_bytes()
evidence=json.loads((b/'EVIDENCE-SHA256.json').read_text())
for n,h in evidence.items():assert hashlib.sha256((b/n).read_bytes()).hexdigest()==h,('frozen evidence',n)
for run in ['kernel-no-output','angular-no-output','spec-types-no-output']:
 result=json.loads((p/'runs'/run/'RESULT.json').read_text());assert result['exit']==0 and result['sourcesUnchangedDuringRun']
 command=json.loads((p/'runs'/run/'COMMAND.json').read_text());assert command['ST_PREPARED_REVIEW_OUTPUT']=='explicitly removed from subprocess environment'
check=p/'patch-check';check.mkdir();r=subprocess.run(['git','apply',str(p/'PROMOTE-TESTS.patch')],cwd=check,capture_output=True,text=True);assert r.returncode==0,r.stderr
assert all((check/n).read_bytes()==(p/'promote'/n).read_bytes() for n in normal)
result={'promotedFiles':sorted(normal),'researchFilesPreservedOutsideCandidate':len(research),'onlyChanges':changed,'allOtherBytesAndAssertionsUnchanged':True,'allRuntimeAndConfigurationUnchanged':True,'frozenSourceFilesVerified':len(m),'frozenEvidenceFilesVerified':len(evidence),'envUnsetRuns':['kernel-no-output','angular-no-output','spec-types-no-output'],'testAdditionPatchRoundtrip':'passed','validationBaseline':'accepted C8 proof, not C9'}
(p/'VERIFICATION.json').write_text(json.dumps(result,indent=2)+'\n')
(p/'COMMANDS.json').write_text(json.dumps({f.parent.name:json.loads(f.read_text()) for f in sorted((p/'runs').glob('*/COMMAND.json'))},indent=2)+'\n')
manifest={n:hashlib.sha256((p/'promote'/n).read_bytes()).hexdigest() for n in sorted(normal)};(p/'PROMOTION-SHA256.json').write_text(json.dumps(manifest,indent=2)+'\n')
(p/'FREEZE.json').write_text(json.dumps({'sourceManifestSha256':inv['sourceManifestSha256'],'promotionManifestSha256':hashlib.sha256((p/'PROMOTION-SHA256.json').read_bytes()).hexdigest(),'promotionPatchSha256':hashlib.sha256((p/'PROMOTE-TESTS.patch').read_bytes()).hexdigest(),'optionalOutputPatchSha256':hashlib.sha256((p/'OPTIONAL-OUTPUT.patch').read_bytes()).hexdigest(),'runtimeEdits':False,'status':'six-file promotion payload validated without ST_PREPARED_REVIEW_OUTPUT'},indent=2)+'\n')
print(json.dumps(result,indent=2))
