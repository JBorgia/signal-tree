"""Read-only joins for completed application runs and canonical local packages."""
import base64
import hashlib
import json
from pathlib import Path
import tarfile

if not __debug__:
    raise RuntimeError('Integrity checks require normal Python execution')

PHASES = ['prepare', 'build', 'conformance', 'context-controls', 'metric-controls',
          'calibration', 'comparison', 'analysis', 'admission-controls']
ARMS = ['native', 'ngrx', 'v15-before', 'v15', 'v16-before', 'v16', 'tanstack', 'tanstack-variant']
COUNTS = {'dispatch': 88, 'context': 32, 'metric': 9, 'calibration': 16,
          'comparison': 288, 'mainSamples': 240, 'sameArtifactSamples': 48, 'admission': 12}
OUTPUTS = {
    'prepare': ['packet/plan.json'], 'build': ['packet/dispatch-build.json'],
    'conformance': ['packet/dispatch-conformance/results.json'],
    'context-controls': ['packet/optimization-context-controls/results.json'],
    'metric-controls': ['metric-controls/results.json'],
    'calibration': ['calibration/results.json'],
    'comparison': ['comparison/results.json', 'comparison/schedule.json'],
    'analysis': ['analysis/summary.json'],
    'admission-controls': ['admission-controls/results.json'],
}


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify(bindings):
    assert bindings, 'Empty binding set'
    for path, digest in bindings.items():
        assert sha(path) == digest, f'Input drift: {path}'


def inventory(root):
    return {str(p.relative_to(root)): sha(p) for p in Path(root).rglob('*') if p.is_file()}


def completed_application(run):
    run = Path(run).resolve()
    plan_path = run / 'plan.json'
    plan, result = read(plan_path), read(run / 'driver-results.json')
    assert plan['output'] == str(run) and plan['kind'] == 'startup-economics-application-v1'
    assert result['passed'] is True and result['planSha256'] == sha(plan_path)
    assert result['counts'] == plan['counts'] == COUNTS
    assert result['identities'] == plan['identities']
    assert plan['phases'] == PHASES
    assert [step['name'] for step in result['steps']] == PHASES
    verify(plan['bindings'])
    bindings = {**plan['bindings'], str(plan_path): sha(plan_path),
                str(run / 'driver-results.json'): sha(run / 'driver-results.json')}
    for step in result['steps']:
        folder = run / 'commands' / step['name']
        receipt_path, log_path = folder / 'receipt.json', folder / 'command.log'
        assert step == read(receipt_path)
        assert step['exitCode'] == 0 and step['planSha256'] == sha(plan_path)
        assert step['logSha256'] == sha(log_path)
        assert set(step['outputs']) == {str(run / p) for p in OUTPUTS[step['name']]}
        verify(step['outputs'])
        bindings.update(step['outputs'])
        bindings.update({str(receipt_path): sha(receipt_path), str(log_path): sha(log_path)})
    packet_path, build_path = run / 'packet/plan.json', run / 'packet/dispatch-build.json'
    packet, build = read(packet_path), read(build_path)
    assert packet['arms'] == ARMS and set(build['arms']) == set(ARMS)
    assert build['planSha256'] == sha(packet_path)
    assert packet['startupEconomics']['currentHeads'] == plan['currentHeads']
    for line in ['v15', 'v16']:
        for name in ['kernel', 'angular']:
            selected = packet['artifacts'][f'{line}-{name}']['sourceIdentity']
            expected = plan['identities'][line][name]
            assert all(selected[key] == expected[key] for key in ['head', 'sourceSeal'])
            assert packet['artifacts'][f'{line}-before-{name}']['sourceIdentity']['head'] == plan['currentHeads'][line]
    bindings.update(packet['inputs'])
    for arm in ARMS:
        bindings.update(build['arms'][arm]['dependencies'])
        bindings.update(build['arms'][arm]['served'])
    summary_path = run / 'analysis/summary.json'
    summary = read(summary_path)
    for relative in ['comparison/results.json', 'comparison/schedule.json']:
        path = run / relative
        assert summary['bindings'].get(str(path)) == sha(path), 'Summary must admit this exact comparison'
    comparison = read(run / 'comparison/results.json')
    assert comparison['passed'] is True and comparison['mode'] == 'compare'
    assert comparison['planned'] == comparison['completed'] == len(comparison['children']) == 288
    for key, path in [('plan', packet_path), ('build', build_path)]:
        assert summary['source'][key + 'Path'] == str(path)
        assert summary['source'][key + 'Sha256'] == sha(path)
        bindings[str(path)] = sha(path)
    bindings.update(summary['bindings'])
    bindings[str(summary_path)] = sha(summary_path)
    verify(bindings)
    return {'bindings': bindings, 'identities': plan['identities'], 'counts': COUNTS}


def canonical_packages(qualification, line):
    q = Path(qualification).resolve()
    checks = q / (line + '-final-artifact-checks')
    result, recorded = read(checks / 'result.json'), read(checks / 'packed-payloads.json')
    expected = result['head']
    assert result['complete'] is True and result['sourceUnchanged'] is True
    assert result['canonicalPayloadsEqual'] is True and result['publication'] is False
    assert recorded['head'] == expected and recorded['everyShippedPayloadMatchesFreshBuild'] is True
    journal_path = checks / 'canonical-candidate/candidate.json'
    journal = read(journal_path)
    assert sha(journal_path) == recorded['journalSha256']
    assert journal['commit'] == expected and journal['state'] == 'validated'
    names = ['kernel', 'angular', 'react', 'vue', 'solid']
    assert [entry['package'] for entry in journal['packages']] == names
    for key in ['archives', 'payloads', 'excludedGeneratedFiles']:
        assert set(recorded[key]) == set(names)
    bindings = {str(path): sha(path) for path in [checks / 'result.json', checks / 'packed-payloads.json', journal_path]}
    seals = set()
    for entry in journal['packages']:
        name = entry['package']
        assert entry['name'] == '@signal-tree/' + name and entry['version'] == journal['version']
        relative = Path(entry['tarball'])
        assert not relative.is_absolute() and '..' not in relative.parts and relative.parts[0] == 'tarballs'
        archive = journal_path.parent / relative
        assert recorded['archives'][name] == {'path': str(archive), 'sha256': sha(archive)}
        assert entry['integrity'] == 'sha512-' + base64.b64encode(hashlib.sha512(archive.read_bytes()).digest()).decode()
        payloads = {}
        with tarfile.open(archive, 'r:gz') as tar:
            for member in tar:
                if member.isdir():
                    continue
                assert member.isfile() and member.name.startswith('package/')
                key = member.name.removeprefix('package/')
                assert key and key not in payloads and not Path(key).is_absolute() and '..' not in Path(key).parts
                payloads[key] = hashlib.sha256(tar.extractfile(member).read()).hexdigest()
        assert payloads == recorded['payloads'][name]
        packed_path, built_path = q / (line + '-final-packed-packages') / (name + '.json'), q / (line + '-final-packages') / (name + '.json')
        packed, built = read(packed_path), read(built_path)
        assert packed['files'] == payloads == inventory(Path(packed['root']))
        assert built['files'] == inventory(Path(built['root']))
        assert all(built['files'].get(key) == value for key, value in payloads.items())
        assert packed['head'] == built['head'] == expected
        for key in ['sourceSeal', 'buildReceipt', 'buildReceiptSha256']:
            assert packed[key] == built[key]
        assert packed['canonicalArchive'] == str(archive) and packed['canonicalArchiveSha256'] == sha(archive)
        assert packed['packingJournal'] == str(journal_path) and packed['packingJournalSha256'] == sha(journal_path)
        omitted = [] if name == 'kernel' else ['dist/index.d.ts']
        assert sorted(set(built['files']) - set(payloads)) == recorded['excludedGeneratedFiles'][name] == packed['excludedGeneratedFiles'] == omitted
        receipt_path = Path(built['buildReceipt'])
        assert sha(receipt_path) == built['buildReceiptSha256']
        receipt = read(receipt_path)
        assert receipt['head'] == expected and receipt['sourceSeal'] == built['sourceSeal']
        assert receipt['exitCode'] == 0 and receipt['sourceUnchanged'] is True and receipt['snapshots']
        seals.add(built['sourceSeal'])
        bindings.update(receipt['snapshots'])
        for p in [archive, packed_path, built_path, receipt_path]:
            bindings[str(p)] = sha(p)
        for descriptor in [packed, built]:
            bindings.update({str(Path(descriptor['root']) / p): h for p, h in descriptor['files'].items()})
    assert len(seals) == 1
    verify(bindings)
    return {'head': expected, 'sourceSeal': next(iter(seals)), 'bindings': bindings,
            'payloads': sum(map(len, recorded['payloads'].values()))}
