import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
// A completed report can update prose after recording a run. Preserve the
// historical bytes through the verified archive; never substitute archived
// bytes for a file the new run will execute, load, compile or serve.
export function resolveHistoricalInputs(inputs, requiredLive, evidence) {
  const bindings = {}, versions = [];
  let manifest;
  const load = () => {
    assert(evidence, 'Historical input drift needs an explicitly bound evidence archive');
    const path = join(resolve(evidence.root), 'manifest.json');
    assert.equal(sha(path), evidence.manifestSha256, 'Evidence manifest drift');
    bindings[path] = evidence.manifestSha256;
    return JSON.parse(readFileSync(path, 'utf8'));
  };
  for (const [original, expected] of Object.entries(inputs)) {
    if (existsSync(original) && sha(original) === expected) { bindings[original] = expected; continue; }
    assert(!requiredLive.has(original), `Executed input drift cannot use historical fallback: ${original}`);
    assert(evidence, 'Historical input drift needs an explicitly bound evidence archive');
    assert(evidence.allowedHistoricalVersions?.some(version => version.original === original && version.sha256 === expected), `Input is not explicitly allowlisted as historical provenance: ${original}`);
    manifest ??= load();
    assert(manifest.entries.some(entry => entry.original === original && entry.sha256 === expected), `No original/version mapping: ${original}`);
    const payload = manifest.payloads[expected];
    assert(payload && !payload.path.startsWith('/') && !payload.path.split('/').includes('..'));
    const path = join(resolve(evidence.root), payload.path);
    assert.equal(sha(path), expected, `Archived payload drift: ${original}`);
    bindings[path] = expected;
    versions.push({ original, sha256: expected, resolved: path, purpose: 'Historical provenance only; not an executed input replacement' });
  }
  for (const path of requiredLive) assert.equal(sha(path), inputs[path], `Executed input drift: ${path}`);
  return { bindings, versions };
}
