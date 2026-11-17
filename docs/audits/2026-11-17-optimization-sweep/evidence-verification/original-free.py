#!/usr/bin/env python3
"""Verify an extracted archive while denying opens outside it and Python stdlib.

EXTRACTED CLOSURE_SHA256 EXISTING_ORIGINAL_PROBE
This is a read-dependency check of the known verifier, not an OS security sandbox.
No payload, manifest, original path, source or verifier is rewritten.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import runpy
import sys
import sysconfig

sys.dont_write_bytecode = True
extracted, closure_digest, original_probe = sys.argv[1:]
root = Path(extracted).resolve(strict=True)
probe = Path(original_probe).resolve(strict=True)
selector_digest = '12811cbe60f20da9f9a873c1bd7b854d16cd5d2a1ec34c439b05178190517f76'
selector = root / 'payloads' / 'sha256' / selector_digest
assert re.fullmatch(r'[0-9a-f]{64}', closure_digest)
assert hashlib.sha256(selector.read_bytes()).hexdigest() == selector_digest
assert probe.is_file() and not probe.is_relative_to(root)
allowed = [root, Path(sysconfig.get_path('stdlib')).resolve(),
           Path(sysconfig.get_config_var('DESTSHARED')).resolve()]
assert not any(probe.is_relative_to(path) for path in allowed)
opened = set()
blocked = []

def audit(event, args):
    if event == 'open':
        value = args[0]
        if isinstance(value, int):
            if value in (0, 1, 2):
                return
            blocked.append(str(value))
            raise PermissionError('Unregistered descriptor open denied')
        path = Path(os.fsdecode(value)).resolve()
        if not any(path.is_relative_to(base) for base in allowed):
            blocked.append(str(path))
            raise PermissionError('Outside extracted archive/stdlib open denied: ' + str(path))
        opened.add(str(path))
    elif event in ('subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn',
                   'socket.connect', 'socket.bind'):
        raise PermissionError('External execution/network denied during archive verification')

os.chdir(root)
sys.addaudithook(audit)
try:
    probe.read_bytes()
except PermissionError:
    pass
else:
    raise AssertionError('Original-path denial control failed')
assert blocked == [str(probe)]
blocked.clear()
sys.argv = [str(selector), 'verify-extracted', str(root), closure_digest]
runpy.run_path(str(selector), run_name='__main__')
assert not blocked, 'Verification attempted an original/outside read'
print(json.dumps({'passed': True, 'kind': 'original-read-denial-verification',
                  'selectorDigest': selector_digest, 'closureDigest': closure_digest,
                  'originalProbeDenied': str(probe), 'verificationOutsideOpens': len(blocked),
                  'distinctOpenedPaths': len(opened), 'allowedRoots': list(map(str, allowed)),
                  'limits': 'Known Python verifier with file-open audit and execution/network denial. Not an OS security boundary or proof against malicious native code.'}))
