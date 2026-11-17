#!/usr/bin/env python3
"""Recompute descriptive paired results for a complete preliminary runtime screen."""
import hashlib, json, pathlib, statistics, subprocess, sys

root, output = (pathlib.Path(value).resolve() for value in sys.argv[1:])
assert not output.exists(), 'Preserve prior analysis'
sha = lambda path: hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
read = lambda path: json.loads(path.read_text())
result = read(root / 'results.json'); assert result['passed'] is True
schedule_path = pathlib.Path(result['schedulePath'])
assert sha(schedule_path) == result['scheduleSha256'], 'schedule-hash'
schedule = read(schedule_path)
expected = []
profile_index = 0
for width in [8, 32]:
    for activation in ['bare', 'native-loaded']:
        for round_number in range(3):
            for arm in (['candidate', 'baseline'] if (round_number + profile_index) % 2 else ['baseline', 'candidate']):
                expected.append(dict(arm=arm, activation=activation, rows=10000, width=width, round=round_number, kind='timing'))
            if round_number != 1:
                for repeat in [0, 1]:
                    expected.append(dict(arm='baseline', activation=activation, rows=10000, width=width, round=round_number, repeat=repeat, kind='timing', control='AA'))
        profile_index += 1
assert schedule['schedule'] == expected, 'exact-schedule'
assert len(result['results']) == 40, 'complete-cohort'
assert result['bindings'] == schedule['bindings'], 'result-schedule-bindings'
bindings = {str(root / 'results.json'): sha(root / 'results.json'), str(schedule_path): sha(schedule_path)}
verified = {}
def verify_bound(path, digest):
    path = str(path)
    assert isinstance(digest, str) and len(digest) == 64, 'binding-digest'
    if path in verified:
        assert verified[path] == digest, 'conflicting-binding'
    else:
        assert sha(pathlib.Path(path)) == digest, 'bound-payload-hash: ' + path
        verified[path] = digest
    bindings[path] = digest
for path, digest in schedule['bindings'].items():
    verify_bound(path, digest)
packets = {}
for arm in ['baseline', 'candidate']:
    packet_path = pathlib.Path(schedule['packets'][arm]) / 'packet.json'
    assert str(packet_path) in schedule['bindings'], 'missing-packet-binding'
    packet = read(packet_path); packets[arm] = packet
    required = {str(packet_path): sha(packet_path), **packet['bindings']}
    for path, digest in required.items():
        assert schedule['bindings'].get(path) == digest, 'missing-packet-input-binding'
        verify_bound(path, digest)
    manifest_path = pathlib.Path(packet['manifestPath'])
    assert str(manifest_path) in packet['bindings'], 'missing-manifest-binding'
    manifest = read(manifest_path)
    for name, digest in manifest['files'].items():
        assert packet['bindings'].get(str(pathlib.Path(manifest['root']) / name)) == digest, 'missing-artifact-binding'
    for bundle in packet['bundles'].values():
        assert packet['bindings'].get(bundle['path']) == bundle['sha256'], 'missing-bundle-binding'
        verify_bound(bundle['path'], bundle['sha256'])
node_path = schedule['command'][0]
assert node_path in schedule['bindings'], 'missing-node-binding'
node_version = subprocess.check_output([node_path, '--version'], text=True).strip()
children = []
for index, (sample, invocation) in enumerate(zip(schedule['schedule'], result['results'], strict=True)):
    assert invocation['passed'] is True and invocation['exitCode'] == 0 and invocation['sample'] == sample, 'invocation-status'
    assert not invocation.get('signal') and not invocation.get('error') and not invocation.get('admissionError'), 'invocation-error'
    invocation_path = root / f'invocation-{index}.json'
    assert read(invocation_path) == invocation, 'invocation-sidecar'
    bindings[str(invocation_path)] = sha(invocation_path)
    verify_bound(invocation['log'], invocation['logSha256'])
    path = pathlib.Path(invocation['resultPath']); verify_bound(path, invocation['resultSha256'])
    child = read(path); assert child['passed'] is True and child['sample'] == sample, 'child-status'
    assert 'cleanupError' not in child and 'error' not in child, 'child-error'
    assert child['node'] == node_version, 'child-node-version'
    assert type(child['pid']) is int and child['pid'] > 0, 'child-pid'
    packet_path = pathlib.Path(child['packetPath']); verify_bound(packet_path, child['packetSha256'])
    packet = packets[sample['arm']]
    assert child['bundleSha256'] == packet['bundles'][sample['activation']]['sha256'], 'child-bundle'
    assert packet_path == pathlib.Path(schedule['packets'][sample['arm']]) / 'packet.json', 'child-packet-path'
    assert set(child['stages']) == {'emptyTree', 'population', 'firstAll', 'sparseWrites', 'broadProjection', 'existingReplacementAndReorder', 'destroy'}, 'child-stage-set'
    for stage in child['stages'].values():
        assert set(stage['cpuMicroseconds']) == {'user', 'system'}, 'cpu-fields'
        for value in [stage['elapsedNs'], stage['cpuMs'], stage['cpuMicroseconds']['user'], stage['cpuMicroseconds']['system']]:
            assert type(value) in (int, float) and value >= 0 and value < float('inf'), 'finite-measurement'
        assert stage['cpuMs'] == sum(stage['cpuMicroseconds'].values()) / 1000, 'cpu-total'
    children.append(child)
bindings[str(pathlib.Path(__file__).resolve())] = sha(pathlib.Path(__file__).resolve())

profiles = []
for width in [8, 32]:
    for activation in ['bare', 'native-loaded']:
        group = [child for child in children if child['sample']['width'] == width and child['sample']['activation'] == activation]
        assert len(group) == 10
        stages = {}
        for stage in children[0]['stages']:
            metrics = {}
            for metric in ['cpuMs', 'elapsedNs']:
                factor = 1 if metric == 'cpuMs' else 1e-6
                arms = {}
                for arm in ['baseline', 'candidate']:
                    selected = sorted([child for child in group if child['sample']['arm'] == arm and not child['sample'].get('control')], key=lambda child: child['sample']['round'])
                    assert [child['sample']['round'] for child in selected] == [0, 1, 2]
                    arms[arm] = [child['stages'][stage][metric] * factor for child in selected]
                delta = [candidate - baseline for baseline, candidate in zip(arms['baseline'], arms['candidate'], strict=True)]
                aa = []
                for round_number in [0, 2]:
                    pair = sorted([child for child in group if child['sample'].get('control') == 'AA' and child['sample']['round'] == round_number], key=lambda child: child['sample']['repeat'])
                    assert [child['sample']['repeat'] for child in pair] == [0, 1]
                    aa.append((pair[1]['stages'][stage][metric] - pair[0]['stages'][stage][metric]) * factor)
                metrics['cpuMs' if metric == 'cpuMs' else 'elapsedMs'] = {'baseline': arms['baseline'], 'candidate': arms['candidate'],
                    'baselineMedian': statistics.median(arms['baseline']), 'candidateMedian': statistics.median(arms['candidate']),
                    'pairedDifferences': delta, 'pairedMedian': statistics.median(delta), 'candidateLowerPairs': sum(value < 0 for value in delta),
                    'aaDifferences': aa, 'aaMaximumAbsolute': max(map(abs, aa))}
            stages[stage] = metrics
        profiles.append({'width': width, 'activation': activation, 'rows': 10000, 'stages': stages})
output.write_text(json.dumps({'kind': 'preliminary-runtime-screen-analysis-v1', 'bindings': bindings, 'children': 40, 'profiles': profiles,
    'limits': 'Three descriptive matched pairs per profile and two A/A pairs. Differences are candidate minus baseline. A/A extrema are observations, not confidence intervals or acceptance thresholds. No heap, Angular, native-recipient or general performance claim.'}, indent=2) + '\n')
for profile in profiles:
    value = profile['stages']['population']['cpuMs']
    print(json.dumps({'width': profile['width'], 'activation': profile['activation'], 'baselineCpuMedian': value['baselineMedian'],
        'candidateCpuMedian': value['candidateMedian'], 'pairedMedian': value['pairedMedian'], 'aaMaximumAbsolute': value['aaMaximumAbsolute']}))
