#!/usr/bin/env python3
"""Post-mutation artifact checks for an exact local candidate; never publishes.

WORKSPACE EXPECTED_HEAD EVIDENCE_ROOT. All outputs are new; failures are retained.
"""
from pathlib import Path
import base64,hashlib,json,os,re,shutil,subprocess,sys,tarfile

workspace=Path(sys.argv[1]).resolve();expected=sys.argv[2];evidence=Path(sys.argv[3]).resolve();resume_mode=sys.argv[4:]
assert resume_mode in [[],['--resume-packed'],['--resume-demo'],['--verify-completed']]
verify_completed=resume_mode==['--verify-completed']
resume=bool(resume_mode);resume_demo=resume_mode in [['--resume-demo'],['--verify-completed']]
line='v16' if json.loads((workspace/'package.json').read_text())['version'].startswith('16.') else 'v15'
output=evidence/(line+'-final-artifact-checks')
if resume:assert output.is_dir() and (output/'packed-payloads.json').exists()==resume_demo
else:assert not output.exists();output.mkdir()
read=lambda p:json.loads(Path(p).read_text());sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
write=lambda p,v:Path(p).write_text(json.dumps(v,indent=2)+'\n')
git=lambda *args:subprocess.check_output(['git',*args],cwd=workspace,text=True).strip()
assert git('rev-parse','HEAD')==expected and not git('status','--porcelain')
source={name:sha(workspace/name) for name in git('ls-files','-z').split('\0') if name and (workspace/name).is_file()}
source_record=output/('completed-validation-source.json' if verify_completed else 'resumed-demo-source.json' if resume_demo else 'resumed-source.json' if resume else 'source.json');assert not source_record.exists()
write(source_record,{'head':expected,'bindings':{str(workspace/name):h for name,h in source.items()},'runner':str(Path(__file__).resolve()),'runnerSha256':sha(__file__)})
def guard():
    changed=[name for name,h in source.items() if not (workspace/name).is_file() or sha(workspace/name)!=h]
    assert not changed,changed
def run(name,command,accepted=(0,),cwd=workspace,environment=None):
    location=output/name
    code=subprocess.run([sys.executable,str(evidence/'run-command.py'),str(location),str(cwd),*command],env=environment).returncode
    assert code in accepted,(name,code)
    return code,(location/'command.log').read_text(errors='replace')
def inventory(root):return {str(p.relative_to(root)):sha(p) for p in sorted(root.rglob('*')) if p.is_file()}
def validate_packed(recorded,journal_value):
    names=['kernel','angular','react','vue','solid']
    assert [entry['package'] for entry in journal_value['packages']]==names
    assert journal_value==read(output/'canonical-candidate/candidate.json')
    assert journal_value['commit']==expected and journal_value['version']==version and journal_value['state']=='validated'
    assert recorded['head']==expected and recorded['journalSha256']==sha(output/'canonical-candidate/candidate.json')
    for key in ['archives','payloads','excludedGeneratedFiles']:assert set(recorded[key])==set(names),(key,'incomplete package set')
    for entry in journal_value['packages']:
        name=entry['package'];assert entry['name']=='@signal-tree/'+name and entry['version']==version
        relative=Path(entry['tarball']);assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0]=='tarballs'
        archive=output/'canonical-candidate'/relative;assert recorded['archives'][name]['path']==str(archive)
        assert recorded['archives'][name]['sha256']==sha(archive)
        assert entry['integrity']=='sha512-'+base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
        files={}
        with tarfile.open(archive,'r:gz') as tar:
            for member in tar.getmembers():
                if member.isdir():continue
                assert member.isfile() and member.name.startswith('package/')
                key=member.name.removeprefix('package/');assert '..' not in Path(key).parts and not Path(key).is_absolute() and key not in files
                files[key]=hashlib.sha256(tar.extractfile(member).read()).hexdigest()
        assert recorded['payloads'][name]==files and inventory(packed/name)==files
        built=read(packages/(name+'.json'));manifest=read(packed/(name+'.json'))
        assert manifest['root']==str(packed/name) and manifest['files']==files
        for key in ['head','sourceSeal','buildReceipt','buildReceiptSha256']:assert manifest[key]==built[key]
        assert manifest['head']==expected and sha(manifest['buildReceipt'])==manifest['buildReceiptSha256']
        receipt=read(manifest['buildReceipt']);assert receipt['head']==expected and receipt['sourceSeal']==manifest['sourceSeal'] and receipt['exitCode']==0 and receipt['sourceUnchanged'] is True
        assert manifest['canonicalArchive']==str(archive) and manifest['canonicalArchiveSha256']==sha(archive)
        assert manifest['packingJournal']==str(output/'canonical-candidate/candidate.json') and manifest['packingJournalSha256']==recorded['journalSha256']
        assert all(built['files'].get(key)==value for key,value in files.items())
        omitted=sorted(set(built['files'])-set(files));assert omitted==([] if name=='kernel' else ['dist/index.d.ts'])
        assert recorded['excludedGeneratedFiles'][name]==omitted and manifest['excludedGeneratedFiles']==omitted
    return {'packages':len(names),'payloads':sum(len(recorded['payloads'][name]) for name in names),'journalArchivePackedBuildJoins':True}
packages=evidence/(line+'-final-packages')
builder=Path(__file__).resolve().parent/'build-packages.py'
if not resume:
    dist=workspace/'dist';assert not dist.is_symlink()
    write(output/'removed-dist.json',{'path':str(dist),'files':inventory(dist) if dist.exists() else {}})
    if dist.exists():shutil.rmtree(dist)
    assert not dist.exists()
    run('fresh-five-package-build',[sys.executable,str(builder),str(workspace),str(packages)])
before=inventory(workspace/'dist/packages')
version=read(workspace/'package.json')['version'];candidate=workspace/'.release/candidates'/version
if not resume:
    assert not candidate.exists(),'Preserve existing candidate; use an explicit new qualification attempt'
    run('canonical-prepare-only',['node','scripts/publish-candidate.mjs','--prebuilt','--prepare-only'])
    assert before==inventory(workspace/'dist/packages'),'Canonical preparation altered build payloads; inspect before comparison'
    shutil.copytree(candidate,output/'canonical-candidate')
else:
    assert read(output/'canonical-prepare-only/receipt.json')['exitCode']==0
    expected_dist={name+'/'+relative:h for name in ['kernel','angular','react','vue','solid'] for relative,h in read(packages/(name+'.json'))['files'].items()}
    assert before==expected_dist,'Resumed generated artifacts drifted'
journal=read(output/'canonical-candidate/candidate.json');assert journal['commit']==expected and journal['state']=='validated'
archives={};payloads={};exclusions={};packed=evidence/(line+'-final-packed-packages')
if resume_demo:
    recorded=read(output/'packed-payloads.json');assert recorded['head']==expected
    packed_validation=validate_packed(recorded,journal)
    for name,entry in recorded['archives'].items():
        assert sha(entry['path'])==entry['sha256'];archives[name]=entry['path']
        assert inventory(packed/name)==recorded['payloads'][name]
    if verify_completed:
        assert read(output/'result.json')['complete'] is True
        import copy
        controls=[]
        for label,key in [('missing archive','archives'),('missing payload map','payloads'),('missing exclusions','excludedGeneratedFiles')]:
            bad=copy.deepcopy(recorded);bad[key].pop('solid')
            try:validate_packed(bad,journal)
            except AssertionError:controls.append(label)
            else:raise AssertionError('Incomplete packed receipt accepted: '+label)
        bad=copy.deepcopy(recorded);bad['archives']={}
        try:validate_packed(bad,journal)
        except AssertionError:controls.append('empty archive set')
        else:raise AssertionError('Empty packed receipt accepted')
        bad=copy.deepcopy(recorded);bad['journalSha256']='0'*64
        try:validate_packed(bad,journal)
        except AssertionError:controls.append('wrong journal identity')
        else:raise AssertionError('Wrong journal identity accepted')
        guard();write(output/'completed-packed-admission.json',{**packed_validation,'positive':True,'rejectedControls':controls,'runnerSha256':sha(__file__),'scope':'Read-only verification of completed artifacts and in-memory admission falsifiers; no rerun or alteration of performance samples.'})
        print(json.dumps(packed_validation));sys.exit(0)
else:assert not packed.exists();packed.mkdir()
for entry in ([] if resume_demo else journal['packages']):
    name=entry['package'];archive=output/'canonical-candidate'/entry['tarball']
    assert entry['integrity']=='sha512-'+base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
    files={};root=packed/name;root.mkdir()
    with tarfile.open(archive,'r:gz') as tar:
        for member in tar.getmembers():
            if member.isdir():continue
            assert member.isfile() and member.name.startswith('package/')
            relative=member.name.removeprefix('package/');assert '..' not in Path(relative).parts and not Path(relative).is_absolute() and relative not in files
            data=tar.extractfile(member).read();files[relative]=hashlib.sha256(data).hexdigest()
            destination=root/relative;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
    built=read(packages/(name+'.json'));built_files=built['files']
    assert all(built_files.get(relative)==h for relative,h in files.items())
    omitted=sorted(set(built_files)-set(files));assert omitted==([] if name=='kernel' else ['dist/index.d.ts'])
    if omitted:
        manifest=read(root/'package.json');assert manifest['exports']['.']['types']=='./src/index.d.ts'
        assert 'dist/**/*.js' in manifest['files'] and 'src/**/*.d.ts' in manifest['files'] and 'dist/**/*.d.ts' not in manifest['files']
    exclusions[name]=omitted
    write(packed/(name+'.json'),{**built,'root':str(root),'files':files,'canonicalArchive':str(archive),'canonicalArchiveSha256':sha(archive),'packingJournal':str(output/'canonical-candidate/candidate.json'),'packingJournalSha256':sha(output/'canonical-candidate/candidate.json'),'excludedGeneratedFiles':omitted,'limits':'Exact canonical packed file set from the bound fresh build. Facade-only dist/index.d.ts is generated but intentionally unshipped; every shipped payload matches the build.'})
    archives[name]=str(archive);payloads[name]=files
if not resume_demo:
    write(output/'packed-payloads.json',{'head':expected,'journalSha256':sha(output/'canonical-candidate/candidate.json'),'archives':{n:{'path':p,'sha256':sha(p)} for n,p in archives.items()},'payloads':payloads,'excludedGeneratedFiles':exclusions,'everyShippedPayloadMatchesFreshBuild':True,'publication':False})
    packed_validation=validate_packed(read(output/'packed-payloads.json'),journal)
    write(output/'packed-admission.json',packed_validation)
    run('angular-aot-consumer',['node','tools/verify-angular-aot-consumer.mjs','--kernel-tarball='+archives['kernel'],'--angular-tarball='+archives['angular']])
    run('facade-closure',['node','tools/verify-gates.mjs','--only=framework-facade-closure,react-ssr-facade'])
    code,log=run('strict-demo-production',['pnpm','nx','build','demo','--configuration=production','--skip-nx-cache'],(0,1))
else:
    for name in ['angular-aot-consumer','facade-closure','strict-demo-production']:
        receipt=read(output/name/'receipt.json');assert sha(output/name/'command.log')==receipt['logSha256']
        assert receipt['exitCode']==(1 if name=='strict-demo-production' else 0)
    code=1;log=(output/'strict-demo-production/command.log').read_text()
log=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',log)
override=False
if code:
    errors=[text for text in log.splitlines() if '[ERROR]' in text]
    assert errors and all('budget' in text for text in errors) and 'bundle initial exceeded maximum budget' in log,'Non-numeric demo build failure'
    project=workspace/'apps/demo/project.json';original=project.read_bytes();value=json.loads(original);original_budgets=value['targets']['build']['configurations']['production']['budgets']
    write(output/'demo-review-override.json',{'source':str(project),'originalSha256':sha(project),'originalBudgets':original_budgets,'scope':'Temporary budgets=[] only to emit an otherwise identical production artifact for behavior review. Strict numeric failure remains failed.'})
    try:
        value['targets']['build']['configurations']['production']['budgets']=[];project.write_text(json.dumps(value,indent=2)+'\n')
        run('demo-production-review',['pnpm','nx','build','demo','--configuration=production','--skip-nx-cache'])
        override=True
    finally:project.write_bytes(original)
    guard()
demo=workspace/'dist/apps/demo/browser';assert (demo/'index.html').is_file()
write(output/'demo-files.json',{'files':{str(demo/name):h for name,h in inventory(demo).items()},'budgetDiagnosticsTemporarilyOverridden':override})
report=output/'route-report.json';env={**os.environ,'PLAYWRIGHT_JSON_OUTPUT_NAME':str(report)}
route_code,_=run('demo-route-smoke',['pnpm','run','smoke:routes','--reporter=json','--retries=0'],(0,1),environment=env)
route=read(report);failed=[]
def visit(suite):
    for spec in suite.get('specs',[]):
        for test in spec['tests']:
            if test['status'] not in ['expected','skipped']:
                failed.append({'file':spec['file'],'title':spec['title'],'status':test['status'],'errors':[r.get('error') for r in test.get('results',[]) if r.get('error')]})
    for child in suite.get('suites',[]):visit(child)
for suite in route['suites']:visit(suite)
assert not route.get('errors'),route.get('errors')
if route_code:
    assert len(failed)==1 and failed[0]['file'].endswith('demo-production-bundle.spec.ts') and failed[0]['title']=='production shell excludes retired eager and development runtimes'
    assert failed[0]['errors'] and all('toBeLessThanOrEqual' in item.get('message','') for item in failed[0]['errors'])
else:assert not failed
write(output/'route-result.json',{'exitCode':route_code,'stats':route['stats'],'failures':failed,'reportSha256':sha(report),'numericFailureOnly':bool(failed)})
for name,command in [
 ('version-claims',['node','scripts/verify-version-claims.js']),
 ('release-state',['node','scripts/verify-release-state.js']),
 ('changelog',['bash','scripts/verify-changelog-entry.sh',version]),
 ('diff-check',['git','diff','--check'])]:run(name,command)
guard();assert before==inventory(workspace/'dist/packages')
write(output/'result.json',{'head':expected,'sourceUnchanged':True,'complete':True,'canonicalPayloadsEqual':True,'strictDemoExit':code,'routeExit':route_code,'publication':False,'limits':'Numeric bundle/demo failures remain failures. No signed release, tag, publication or deployment. This script does not replace the full normal and mutation registry.'})
print(output)
