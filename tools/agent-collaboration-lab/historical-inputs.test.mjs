import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { resolveHistoricalInputs } from './historical-inputs.mjs';

test('historical provenance resolution never substitutes executed inputs or unbound payloads', () => {
  const root = mkdtempSync(join(tmpdir(), 'st-historical-input-controls-'));
  const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
  const original = join(root, 'original.md'), payload = join(root, 'payloads', 'old');
  mkdirSync(join(root, 'payloads')); writeFileSync(original, 'original'); writeFileSync(payload, 'original');
  const expected = sha(original), inputs = { [original]: expected };
  assert.deepEqual(resolveHistoricalInputs(inputs, new Set([original])).bindings, inputs);
  writeFileSync(original, 'later report prose');
  const path = join(root, 'manifest.json');
  const manifest = { entries: [{ original, sha256: expected }], payloads: { [expected]: { path: 'payloads/old' } } };
  writeFileSync(path, JSON.stringify(manifest));
  const evidence = { root, manifestSha256: sha(path), allowedHistoricalVersions: [{ original, sha256: expected }] };
  try {
    assert.throws(() => resolveHistoricalInputs(inputs, new Set([original]), evidence), /Executed input drift/);
    assert.throws(() => resolveHistoricalInputs(inputs, new Set()), /explicitly bound/);
    assert.throws(() => resolveHistoricalInputs(inputs, new Set(), { ...evidence, allowedHistoricalVersions: [] }), /explicitly allowlisted/);
    const resolved = resolveHistoricalInputs(inputs, new Set(), evidence);
    assert.equal(resolved.bindings[payload], expected);
    assert.deepEqual(resolved.versions.map(value => [value.original, value.sha256, value.resolved]), [[original, expected, payload]]);
    writeFileSync(payload, 'corrupt');
    assert.throws(() => resolveHistoricalInputs(inputs, new Set(), evidence), /Archived payload drift/);
    writeFileSync(payload, 'original');
    writeFileSync(path, JSON.stringify({ ...manifest, entries: [] }));
    assert.throws(() => resolveHistoricalInputs(inputs, new Set(), evidence), /Evidence manifest drift/);
    assert.throws(() => resolveHistoricalInputs(inputs, new Set(), { ...evidence, manifestSha256: sha(path) }), /No original\/version mapping/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
