"""Verify downloaded registry archives against the exact CI publication journal."""
import argparse
import base64
import datetime
import hashlib
import json
import subprocess
from pathlib import Path
from urllib.parse import quote

parser = argparse.ArgumentParser()
parser.add_argument('--candidate', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--commit', required=True)
parser.add_argument('--version', required=True)
parser.add_argument('--channel', required=True)
parser.add_argument('--stable', required=True)
args = parser.parse_args()
journal = json.loads(args.candidate.read_text())
assert journal['commit'] == args.commit
assert journal['version'] == args.version
assert journal['tag'] == args.channel
assert {p['name'] for p in journal['packages']} == {
    '@signal-tree/' + name for name in ('kernel', 'angular', 'react', 'vue', 'solid')
}
args.output.mkdir(parents=True, exist_ok=True)

def fetch(url):
    # Use macOS's system trust store; the local Python installation has no CA
    # bundle configured. TLS verification remains enabled.
    return subprocess.check_output([
        '/usr/bin/curl', '--fail', '--silent', '--show-error', '--location',
        '--max-time', '60', '--header', 'Accept: application/json', url
    ])

def save_json(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

results = []
for package in journal['packages']:
    name = package['name']
    encoded = quote(name, safe='')
    metadata = json.loads(fetch(f'https://registry.npmjs.org/{encoded}/{args.version}'))
    tags = json.loads(fetch(f'https://registry.npmjs.org/-/package/{encoded}/dist-tags'))
    assert metadata['name'] == name and metadata['version'] == args.version
    assert tags[args.channel] == args.version
    assert tags['latest'] == args.stable
    dist = metadata['dist']
    assert dist['integrity'] == package['integrity']
    assert dist.get('signatures') and dist.get('attestations', {}).get('url')
    tarball = fetch(dist['tarball'])
    integrity = 'sha512-' + base64.b64encode(hashlib.sha512(tarball).digest()).decode()
    assert integrity == package['integrity']
    assert hashlib.sha1(tarball).hexdigest() == dist['shasum']
    ci_tarball = args.candidate.parent / package['tarball']
    assert ci_tarball.read_bytes() == tarball
    basename = package['package']
    output = args.output / Path(package['tarball']).name
    output.write_bytes(tarball)
    attestation = json.loads(fetch(dist['attestations']['url']))
    save_json(args.output / f'{basename}-metadata.json', metadata)
    save_json(args.output / f'{basename}-dist-tags.json', tags)
    save_json(args.output / f'{basename}-attestations.json', attestation)
    results.append({'name': name, 'version': args.version, 'integrity': integrity,
                    'bytes': len(tarball), 'archive': output.name,
                    'identicalToCiArchive': True, 'channel': tags[args.channel],
                    'latest': tags['latest'], 'signatureAndAttestationPresent': True})
    print(name, args.version, 'CI/registry archive identity and channel verified', flush=True)
save_json(args.output / 'verification.json', {
    'verifiedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceCommit': args.commit, 'candidate': str(args.candidate), 'packages': results,
    'limit': 'Hash, archive and channel verification. Cryptographic signature/provenance validation is a separate npm audit signatures check.'})
